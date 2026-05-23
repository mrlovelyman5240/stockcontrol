"""Tests for the FAZ 0 / FAZ 1 security fixes from TODO.md.

These tests cover the security-critical behaviors that the refactors introduced
and that we don't want to regress on:

- public /auth/register must refuse role=boss
- order creation ignores client-sent `total` and `price`
- generic PUT /orders/{id} cannot mutate status (must go through /complete or /cancel)
- numeric constraints: PaymentCreate.amount > 0, DriverHoursCreate.hours > 0
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")

BOSS_USER = {"username": "boss", "password": "boss123"}
SERVICE_USER = {"username": "service1", "password": "service123"}


@pytest.fixture
def boss_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def service_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def driver_info(service_token):
    headers = {"Authorization": f"Bearer {service_token}"}
    drivers = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers).json()
    return drivers[0] if drivers else None


class TestPublicRegisterBlocksBoss:
    """FAZ 0.1 — Public /auth/register must reject role=boss."""

    def test_register_with_role_boss_is_rejected(self):
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": "TEST_RegisterBossAttempt",
            "password": "x12345678",
            "role": "boss",
        })
        assert response.status_code in (400, 403), response.text

    def test_register_with_role_driver_is_allowed(self):
        username = "TEST_RegisterDriverOK"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": username,
            "password": "x12345678",
            "role": "driver",
        })
        if response.status_code == 200:
            # cleanup
            login = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER).json()
            headers = {"Authorization": f"Bearer {login['access_token']}"}
            users = requests.get(f"{BASE_URL}/api/users", headers=headers).json()
            created = next((u for u in users if u["username"] == username), None)
            if created:
                requests.delete(f"{BASE_URL}/api/users/{created['id']}", headers=headers)
        else:
            # In case driver self-registration is fully disabled (env-dependent), accept that too
            assert response.status_code in (400, 403, 404), response.text


class TestOrderCreateIgnoresClientTotalAndPrice:
    """FAZ 0.4 — backend must recompute `total` from DB prices, never trust client."""

    @pytest.fixture
    def cheap_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_PriceRecompute_Item",
            "price": 10.00,
            "stock": 50,
            "variants": [],
        }, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_client_sent_inflated_price_is_ignored(self, service_token, driver_info, cheap_item):
        """If client claims price=1.00 on a $10.00 item, backend must charge $10."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = cheap_item

        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_ClientPriceIgnoredOrder",
            "items": [{
                "item_id": item["id"], "name": item["name"],
                "price": 1.00,  # lying!
                "quantity": 2, "variant_name": None, "is_free_gift": False,
            }],
            "total": 2.00,  # lying!
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert order.status_code == 200, order.text
        saved = order.json()
        assert saved["total"] == 20.00, f"Backend must recompute to 20.00, got {saved['total']}"
        for line in saved["items"]:
            assert line["price"] == 10.00, f"Line price must come from DB, got {line['price']}"

        requests.delete(f"{BASE_URL}/api/orders/{saved['id']}", headers=headers)


class TestGenericPutCannotMutateStatus:
    """FAZ 0.7 + base-stock ch5 — generic PUT /orders/{id} must not accept status.
    Status transitions only go through /complete and /cancel."""

    @pytest.fixture
    def pending_order(self, service_token, driver_info):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_StatusBypass_Item", "price": 5.00, "stock": 10, "variants": [],
        }, headers=headers).json()
        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_StatusBypassOrder",
            "items": [{"item_id": item["id"], "name": item["name"], "price": 5.00,
                       "quantity": 1, "variant_name": None, "is_free_gift": False}],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers).json()
        yield order, item
        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_generic_put_with_status_does_not_change_status(self, service_token, pending_order):
        """Status field in OrderUpdate is silently ignored (model dropped it).
        The order must stay pending, and stock must not be restored."""
        headers = {"Authorization": f"Bearer {service_token}"}
        order, item = pending_order

        response = requests.put(f"{BASE_URL}/api/orders/{order['id']}", json={
            "status": "cancelled",
        }, headers=headers)
        # Either 200 (status silently ignored) or 422 (rejected). Both acceptable —
        # what must NOT happen is the order becoming cancelled with stock restored.
        assert response.status_code in (200, 422), response.text

        # Re-fetch and verify still pending
        order_after = next(o for o in requests.get(f"{BASE_URL}/api/orders", headers=headers).json() if o["id"] == order["id"])
        assert order_after["status"] == "pending"

        # Verify stock was not restored (would be 10 if restored, 9 if not)
        inv_after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert inv_after["stock"] == 9, "Generic PUT must not trigger stock restore"


class TestNumericConstraints:
    """FAZ 0.9 — Pydantic numeric validators."""

    def test_payment_create_rejects_zero_amount(self, driver_info, boss_token):
        if not driver_info:
            pytest.skip("No driver available")
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.post(f"{BASE_URL}/api/payments", json={
            "driver_id": driver_info["id"],
            "amount": 0,
        }, headers=headers)
        assert response.status_code in (400, 422), response.text

    def test_payment_create_rejects_negative_amount(self, driver_info, boss_token):
        if not driver_info:
            pytest.skip("No driver available")
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.post(f"{BASE_URL}/api/payments", json={
            "driver_id": driver_info["id"],
            "amount": -50,
        }, headers=headers)
        assert response.status_code in (400, 422), response.text

    def test_driver_hours_create_rejects_zero(self, driver_info, boss_token):
        if not driver_info:
            pytest.skip("No driver available")
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.post(f"{BASE_URL}/api/driver-hours", json={
            "driver_id": driver_info["id"],
            "date": "2026-05-23",
            "hours": 0,
        }, headers=headers)
        assert response.status_code in (400, 422), response.text


class TestInventoryNumericConstraints:
    """FAZ 0.9 — price and stock must be >= 0."""

    def test_inventory_rejects_negative_price(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_NegPriceItem", "price": -5.00, "stock": 10, "variants": [],
        }, headers=headers)
        assert response.status_code in (400, 422), response.text

    def test_inventory_rejects_negative_stock(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_NegStockItem", "price": 5.00, "stock": -10, "variants": [],
        }, headers=headers)
        assert response.status_code in (400, 422), response.text


class TestCleanup:
    def test_cleanup_test_orders(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        for o in requests.get(f"{BASE_URL}/api/orders", headers=headers).json():
            if o.get("address", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/orders/{o['id']}", headers=headers)

    def test_cleanup_test_inventory(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        for it in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json():
            if it.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/inventory/{it['id']}", headers=headers)
