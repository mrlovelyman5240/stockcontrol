"""
Backend API Tests for Stockcontrol — Base-Stock Model

Model:
- Each inventory item has a single `stock` field at the product level (base stock).
- Variants describe consumption via `units_per` (default 1) — how many base
  units one sale of that variant consumes. Variants do NOT carry their own stock.
- Creating an order deducts `quantity * units_per` from `product.stock` atomically.
- Cancelling/deleting a pending order restores using the `units_per` snapshotted
  on each OrderItem (so later units_per changes don't break reversal).
"""

import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')

SERVICE_USER = {"username": "service1", "password": "service123"}


@pytest.fixture
def service_token():
    response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture
def driver_info(service_token):
    headers = {"Authorization": f"Bearer {service_token}"}
    response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
    drivers = response.json()
    return drivers[0] if drivers else None


class TestInventoryUnitsPer:
    """Variants carry units_per, not stock. Product-level stock is the source of truth."""

    def test_create_inventory_with_units_per_variants(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}

        item_data = {
            "name": "TEST_UnitsPer_Item",
            "price": 10.00,
            "stock": 100,
            "variants": [
                {"name": "Single", "price": 10.00, "units_per": 1},
                {"name": "Pack of 6", "price": 55.00, "units_per": 6},
                {"name": "Case of 24", "price": 200.00, "units_per": 24},
            ],
        }

        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        data = response.json()

        assert data["stock"] == 100
        assert len(data["variants"]) == 3
        assert data["variants"][0]["units_per"] == 1
        assert data["variants"][1]["units_per"] == 6
        assert data["variants"][2]["units_per"] == 24

        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=headers)

    def test_units_per_defaults_to_one_when_omitted(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}

        item_data = {
            "name": "TEST_DefaultUnitsPer_Item",
            "price": 5.00,
            "stock": 10,
            "variants": [{"name": "Default", "price": 5.00}],
        }

        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["variants"][0]["units_per"] == 1

        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=headers)

    def test_units_per_must_be_positive(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}

        item_data = {
            "name": "TEST_BadUnitsPer_Item",
            "price": 5.00,
            "stock": 10,
            "variants": [{"name": "Bad", "price": 5.00, "units_per": 0}],
        }

        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code in (400, 422), f"Expected validation error, got {response.status_code}: {response.text}"


class TestOrderDeductsBaseStock:
    """Order creation deducts quantity * units_per from product.stock."""

    @pytest.fixture
    def item_with_packs(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item_data = {
            "name": "TEST_PackDeduction_Item",
            "price": 10.00,
            "stock": 100,
            "variants": [
                {"name": "Single", "price": 10.00, "units_per": 1},
                {"name": "Pack of 6", "price": 55.00, "units_per": 6},
            ],
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_variant_order_deducts_quantity_times_units_per(self, service_token, driver_info, item_with_packs):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_with_packs

        order_data = {
            "address": "TEST_PackOrder",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Pack of 6)",
                "price": 55.00,
                "quantity": 3,
                "variant_name": "Pack of 6",
                "is_free_gift": False,
            }],
            "total": 165.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }

        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, response.text
        order = response.json()

        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        updated = next(i for i in inv_response.json() if i["id"] == item["id"])
        assert updated["stock"] == 100 - (3 * 6)

        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)

    def test_order_exceeding_base_stock_returns_400(self, service_token, driver_info, item_with_packs):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_with_packs

        # 20 packs * 6 units = 120 > stock 100
        order_data = {
            "address": "TEST_InsufficientPackOrder",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Pack of 6)",
                "price": 55.00,
                "quantity": 20,
                "variant_name": "Pack of 6",
                "is_free_gift": False,
            }],
            "total": 1100.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }

        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 400, response.text
        assert "stock" in response.json().get("detail", "").lower()


class TestOrderCancelRestoresBaseStock:
    """Cancelling a pending order restores quantity * units_per (using the OrderItem snapshot)."""

    @pytest.fixture
    def item_for_cancel(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item_data = {
            "name": "TEST_CancelRestore_Item",
            "price": 12.00,
            "stock": 60,
            "variants": [{"name": "Pack of 4", "price": 45.00, "units_per": 4}],
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_cancel_restores_base_stock_using_snapshot(self, service_token, driver_info, item_for_cancel):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_for_cancel

        order_data = {
            "address": "TEST_CancelRestoreOrder",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Pack of 4)",
                "price": 45.00,
                "quantity": 5,
                "variant_name": "Pack of 4",
                "is_free_gift": False,
            }],
            "total": 225.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }

        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert order_response.status_code == 200
        order = order_response.json()

        after_create = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_create["stock"] == 60 - (5 * 4)

        cancel_response = requests.put(f"{BASE_URL}/api/orders/{order['id']}/cancel", headers=headers)
        assert cancel_response.status_code == 200, cancel_response.text
        assert cancel_response.json()["status"] == "cancelled"

        after_cancel = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_cancel["stock"] == 60

    def test_cancel_uses_orderitem_snapshot_not_current_variant(self, service_token, driver_info, item_for_cancel):
        """If units_per is changed on the variant after the order, cancel must use the snapshot."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_for_cancel

        order_data = {
            "address": "TEST_SnapshotIntegrityOrder",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Pack of 4)",
                "price": 45.00,
                "quantity": 2,
                "variant_name": "Pack of 4",
                "is_free_gift": False,
            }],
            "total": 90.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }
        order = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers).json()

        # Mutate variant's units_per from 4 to 10 on inventory after the order
        mutated = {
            "name": item["name"],
            "price": item["price"],
            "stock": item["stock"] - (2 * 4),
            "variants": [{"name": "Pack of 4", "price": 45.00, "units_per": 10}],
        }
        update_response = requests.put(f"{BASE_URL}/api/inventory/{item['id']}", json=mutated, headers=headers)
        assert update_response.status_code == 200, update_response.text

        # Cancel must restore 2 * 4 = 8 (snapshot), not 2 * 10 = 20 (current)
        cancel_response = requests.put(f"{BASE_URL}/api/orders/{order['id']}/cancel", headers=headers)
        assert cancel_response.status_code == 200

        after_cancel = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_cancel["stock"] == item["stock"], (
            f"Expected snapshot-based restore to {item['stock']}, got {after_cancel['stock']}"
        )


class TestNonVariantProductStock:
    """Products without variants behave as units_per=1 (deduct quantity directly)."""

    @pytest.fixture
    def non_variant_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item_data = {
            "name": "TEST_NonVariant_Item",
            "price": 8.99,
            "stock": 30,
            "variants": [],
        }
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_non_variant_order_deducts_quantity(self, service_token, driver_info, non_variant_item):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = non_variant_item

        order_data = {
            "address": "TEST_NonVariantOrder",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 4,
                "variant_name": None,
                "is_free_gift": False,
            }],
            "total": item["price"] * 4,
            "order_type": "pickup",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }

        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, response.text
        order = response.json()

        updated = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert updated["stock"] == 30 - 4

        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)

    def test_non_variant_insufficient_stock_returns_400(self, service_token, driver_info, non_variant_item):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = non_variant_item

        order_data = {
            "address": "TEST_NonVariantInsufficientOrder",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 50,
                "variant_name": None,
                "is_free_gift": False,
            }],
            "total": item["price"] * 50,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"],
        }

        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 400, response.text


class TestDeleteSnapshotIntegrity:
    """Deleting a pending order restores using the OrderItem.units_per snapshot,
    not whatever the variant currently stores."""

    @pytest.fixture
    def item_for_delete(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item_data = {
            "name": "TEST_DeleteSnapshot_Item",
            "price": 10.00,
            "stock": 50,
            "variants": [{"name": "Pack of 5", "price": 45.00, "units_per": 5}],
        }
        item = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_pending_delete_uses_orderitem_snapshot(self, service_token, driver_info, item_for_delete):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_for_delete

        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_DeleteSnapshotOrder",
            "items": [{
                "item_id": item["id"], "name": item["name"], "price": 45.00,
                "quantity": 3, "variant_name": "Pack of 5", "is_free_gift": False,
            }],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers).json()

        # Mutate variant.units_per 5 → 20 after order creation
        requests.put(f"{BASE_URL}/api/inventory/{item['id']}", json={
            "name": item["name"], "price": item["price"], "stock": item["stock"] - (3 * 5),
            "variants": [{"name": "Pack of 5", "price": 45.00, "units_per": 20}],
        }, headers=headers)

        # Delete the pending order — must restore 3*5=15, not 3*20=60
        delete_response = requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
        assert delete_response.status_code == 200, delete_response.text

        after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after["stock"] == item["stock"], (
            f"Delete should restore via snapshot to {item['stock']}, got {after['stock']}"
        )

    def test_cancelled_delete_does_not_double_restore(self, service_token, driver_info, item_for_delete):
        """A delete on an already-cancelled order must NOT restore stock again
        (cancellation already did)."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = item_for_delete

        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_CancelThenDeleteOrder",
            "items": [{
                "item_id": item["id"], "name": item["name"], "price": 45.00,
                "quantity": 2, "variant_name": "Pack of 5", "is_free_gift": False,
            }],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers).json()

        requests.put(f"{BASE_URL}/api/orders/{order['id']}/cancel", headers=headers)
        after_cancel = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_cancel["stock"] == item["stock"]  # restored by cancel

        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
        after_delete = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_delete["stock"] == item["stock"], "Delete on cancelled order must not re-restore"


class TestMultiLineSameProduct:
    """One order with multiple lines pointing at the same product (different variants
    and one non-variant) consumes from the shared base stock pool, and on failure
    rolls back every line atomically."""

    @pytest.fixture
    def shared_pool_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_SharedPool_Item",
            "price": 10.00,
            "stock": 100,
            "variants": [
                {"name": "Single", "price": 10.00, "units_per": 1},
                {"name": "Pack of 4", "price": 36.00, "units_per": 4},
            ],
        }, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_multiple_lines_consume_shared_pool(self, service_token, driver_info, shared_pool_item):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = shared_pool_item

        # 5 singles (5) + 10 packs (40) = 45 from base 100
        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_SharedPoolOrder",
            "items": [
                {"item_id": item["id"], "name": f"{item['name']} (Single)", "price": 10.00,
                 "quantity": 5, "variant_name": "Single", "is_free_gift": False},
                {"item_id": item["id"], "name": f"{item['name']} (Pack of 4)", "price": 36.00,
                 "quantity": 10, "variant_name": "Pack of 4", "is_free_gift": False},
            ],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert order.status_code == 200, order.text

        after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after["stock"] == 100 - 5 - (10 * 4)

    def test_partial_failure_rolls_back_all_lines(self, service_token, driver_info, shared_pool_item):
        """Two lines: first fits (deducts), second exceeds → server must roll back
        the first line's deduction so net change is zero."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = shared_pool_item

        # 20 singles (20) succeeds first; then 30 packs (120) exceeds remaining 80 → fail
        response = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_PartialFailRollback",
            "items": [
                {"item_id": item["id"], "name": f"{item['name']} (Single)", "price": 10.00,
                 "quantity": 20, "variant_name": "Single", "is_free_gift": False},
                {"item_id": item["id"], "name": f"{item['name']} (Pack of 4)", "price": 36.00,
                 "quantity": 30, "variant_name": "Pack of 4", "is_free_gift": False},
            ],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert response.status_code == 400, response.text

        after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after["stock"] == 100, (
            f"Failed order must roll back prior line deduction; expected 100, got {after['stock']}"
        )


class TestBoundaryStock:
    """Exact stock/units_per boundaries."""

    @pytest.fixture
    def small_pack_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_Boundary_Item",
            "price": 5.00,
            "stock": 12,
            "variants": [{"name": "Pack of 6", "price": 25.00, "units_per": 6}],
        }, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_exact_boundary_succeeds(self, service_token, driver_info, small_pack_item):
        """stock=12, units_per=6, qty=2 → uses exactly 12."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = small_pack_item

        response = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_BoundaryExactOrder",
            "items": [{"item_id": item["id"], "name": item["name"], "price": 25.00,
                       "quantity": 2, "variant_name": "Pack of 6", "is_free_gift": False}],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert response.status_code == 200, response.text

        after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after["stock"] == 0

    def test_one_over_boundary_fails(self, service_token, driver_info, small_pack_item):
        """stock=12, units_per=6, qty=3 needs 18 → rejected."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = small_pack_item

        response = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_BoundaryOverOrder",
            "items": [{"item_id": item["id"], "name": item["name"], "price": 25.00,
                       "quantity": 3, "variant_name": "Pack of 6", "is_free_gift": False}],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert response.status_code == 400, response.text

    def test_remainder_less_than_one_unit_rejects(self, service_token, driver_info):
        """stock=5, units_per=6 → max orderable quantity is 0."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_RemainderItem", "price": 5.00, "stock": 5,
            "variants": [{"name": "Pack of 6", "price": 25.00, "units_per": 6}],
        }, headers=headers).json()
        try:
            response = requests.post(f"{BASE_URL}/api/orders", json={
                "address": "TEST_RemainderOrder",
                "items": [{"item_id": item["id"], "name": item["name"], "price": 25.00,
                           "quantity": 1, "variant_name": "Pack of 6", "is_free_gift": False}],
                "order_type": "delivery",
                "driver_id": driver_info["id"], "driver_name": driver_info["username"],
            }, headers=headers)
            assert response.status_code == 400, response.text
        finally:
            requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)


class TestFreeGiftStock:
    """Free gifts deduct base stock at creation and restore on cancel/delete."""

    @pytest.fixture
    def gift_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_Gift_Item", "price": 8.00, "stock": 20,
            "variants": [{"name": "Pack of 2", "price": 14.00, "units_per": 2}],
        }, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_free_gift_variant_deducts_units_per(self, service_token, driver_info, gift_item):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = gift_item

        order = requests.post(f"{BASE_URL}/api/orders", json={
            "address": "TEST_GiftDeductOrder",
            "items": [{"item_id": item["id"], "name": f"{item['name']} (Pack of 2)",
                       "price": 0.0, "quantity": 1, "variant_name": "Pack of 2",
                       "is_free_gift": True}],
            "order_type": "delivery",
            "driver_id": driver_info["id"], "driver_name": driver_info["username"],
        }, headers=headers)
        assert order.status_code == 200, order.text

        after_create = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_create["stock"] == 20 - 2  # 1 gift × units_per 2

        requests.put(f"{BASE_URL}/api/orders/{order.json()['id']}/cancel", headers=headers)
        after_cancel = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
        assert after_cancel["stock"] == 20, "Cancel must restore gift's deducted units"


class TestUnitsPerCorruption:
    """Stored units_per values that aren't positive integers must fail loud, not
    coerce to 1. (Strict validation added in ch7.)"""

    @pytest.fixture
    def good_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_CorruptUP_Item", "price": 5.00, "stock": 30,
            "variants": [{"name": "Normal", "price": 5.00, "units_per": 2}],
        }, headers=headers).json()
        yield item
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)

    def test_inventory_create_rejects_negative_units_per(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_NegUP_Item", "price": 5.00, "stock": 10,
            "variants": [{"name": "Bad", "price": 5.00, "units_per": -3}],
        }, headers=headers)
        assert response.status_code in (400, 422), response.text

    def test_inventory_create_units_per_missing_defaults_to_one(self, service_token, driver_info):
        """When variant omits units_per entirely, it defaults to 1 and order deduction matches quantity."""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = requests.post(f"{BASE_URL}/api/inventory", json={
            "name": "TEST_MissingUP_Item", "price": 5.00, "stock": 10,
            "variants": [{"name": "PlainDefault", "price": 5.00}],
        }, headers=headers).json()
        try:
            order = requests.post(f"{BASE_URL}/api/orders", json={
                "address": "TEST_MissingUPOrder",
                "items": [{"item_id": item["id"], "name": item["name"], "price": 5.00,
                           "quantity": 3, "variant_name": "PlainDefault", "is_free_gift": False}],
                "order_type": "delivery",
                "driver_id": driver_info["id"], "driver_name": driver_info["username"],
            }, headers=headers)
            assert order.status_code == 200, order.text
            after = next(i for i in requests.get(f"{BASE_URL}/api/inventory", headers=headers).json() if i["id"] == item["id"])
            assert after["stock"] == 7  # 10 - 3*1
        finally:
            requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)


class TestCleanup:
    def test_cleanup_test_orders(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        orders = requests.get(f"{BASE_URL}/api/orders", headers=headers).json()
        for order in orders:
            if order.get("address", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)

    def test_cleanup_test_inventory(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        items = requests.get(f"{BASE_URL}/api/inventory", headers=headers).json()
        for item in items:
            if item.get("name", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
