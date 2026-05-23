"""
Test suite for UI/UX Cleanup & Financial Center Overhaul (Iteration 6)

Features tested:
1. Photo upload endpoints REMOVED (should 404/405)
2. Driver can mark own orders as Done (PUT /api/orders/{id}/complete)
3. Driver CANNOT mark other driver's orders as Done (403)
4. Finance Center API (ledger with filters)
5. Payments API (approve/reject)
6. Boss stats API (pending_payments, pending_collections)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthAndSetup:
    """Authentication and seed data setup"""
    
    @pytest.fixture(scope="class")
    def seed_data(self):
        """Ensure seed data exists"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code in [200, 201]
        return response.json()
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("Health check passed")
    
    def test_boss_login(self, seed_data):
        """Test boss login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss",
            "password": "boss123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "boss"
        print(f"Boss login successful: {data['user']['username']}")
    
    def test_driver1_login(self, seed_data):
        """Test driver1 login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "driver"
        print(f"Driver1 login successful: {data['user']['username']}")
    
    def test_driver2_login(self, seed_data):
        """Test driver2 login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver2",
            "password": "driver123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "driver"
        print(f"Driver2 login successful: {data['user']['username']}")
    
    def test_service_login(self, seed_data):
        """Test customer service login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "service1",
            "password": "service123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer_service"
        print(f"Service login successful: {data['user']['username']}")


class TestPhotoUploadRemoved:
    """Test that photo upload endpoints are REMOVED"""
    
    @pytest.fixture(scope="class")
    def driver_token(self):
        """Get driver token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_photo_upload_endpoint_removed(self, driver_token):
        """POST /api/orders/{id}/photo should return 404 or 405 (endpoint removed)"""
        headers = {"Authorization": f"Bearer {driver_token}"}
        fake_order_id = str(uuid.uuid4())
        
        # Try to upload a photo - should fail with 404/405 since endpoint is removed
        response = requests.post(
            f"{BASE_URL}/api/orders/{fake_order_id}/photo",
            headers=headers,
            files={"file": ("test.jpg", b"fake image data", "image/jpeg")}
        )
        
        # Endpoint should not exist anymore
        assert response.status_code in [404, 405, 422], f"Expected 404/405/422, got {response.status_code}"
        print(f"Photo upload endpoint correctly removed (status: {response.status_code})")


class TestDriverCompleteOrder:
    """Test driver can mark their own orders as Done"""
    
    @pytest.fixture(scope="class")
    def service_token(self):
        """Get service token for creating orders"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "service1",
            "password": "service123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def driver1_data(self):
        """Get driver1 token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        data = response.json()
        return {"token": data["access_token"], "user": data["user"]}
    
    @pytest.fixture(scope="class")
    def driver2_data(self):
        """Get driver2 token and user info"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver2",
            "password": "driver123"
        })
        data = response.json()
        return {"token": data["access_token"], "user": data["user"]}
    
    @pytest.fixture(scope="class")
    def test_order_for_driver1(self, service_token, driver1_data):
        """Create a test order assigned to driver1"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # Get inventory first
        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        inventory = inv_response.json()
        
        if not inventory:
            pytest.skip("No inventory items available")
        
        # Base-stock model: variants no longer carry stock — product.stock is the
        # source of truth. Pick the first product with stock; if it has variants,
        # use the first variant's name/price for the order line.
        item = None
        variant_name = None
        price = 10.0

        for inv_item in inventory:
            if inv_item.get("stock", 0) > 0:
                item = inv_item
                if inv_item.get("variants"):
                    variant_name = inv_item["variants"][0]["name"]
                    price = inv_item["variants"][0]["price"]
                else:
                    price = inv_item.get("price", 10.0)
                break

        if not item:
            pytest.skip("No inventory items with stock available")
        
        order_data = {
            "address": f"TEST_Driver1_Order_{uuid.uuid4().hex[:8]}",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": price,
                "quantity": 1,
                "variant_name": variant_name,
                "is_free_gift": False
            }],
            "total": price,
            "order_type": "delivery",
            "driver_id": driver1_data["user"]["id"],
            "driver_name": driver1_data["user"]["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", headers=headers, json=order_data)
        assert response.status_code in [200, 201], f"Failed to create order: {response.text}"
        return response.json()
    
    def test_driver_can_complete_own_order(self, driver1_data, test_order_for_driver1):
        """Driver1 can mark their own order as Done"""
        headers = {"Authorization": f"Bearer {driver1_data['token']}"}
        order_id = test_order_for_driver1["id"]
        
        response = requests.put(f"{BASE_URL}/api/orders/{order_id}/complete", headers=headers)
        assert response.status_code == 200, f"Failed to complete order: {response.text}"
        
        data = response.json()
        assert data["status"] == "completed"
        print(f"Driver1 successfully completed their own order: {order_id[:8]}")
    
    def test_driver_cannot_complete_other_driver_order(self, service_token, driver1_data, driver2_data):
        """Driver2 CANNOT mark driver1's order as Done (403)"""
        headers_service = {"Authorization": f"Bearer {service_token}"}
        headers_driver2 = {"Authorization": f"Bearer {driver2_data['token']}"}
        
        # Get inventory
        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers_service)
        inventory = inv_response.json()
        
        if not inventory:
            pytest.skip("No inventory items available")
        
        # Base-stock model: pick a product with stock; use first variant if any.
        item = None
        variant_name = None
        price = 10.0

        for inv_item in inventory:
            if inv_item.get("stock", 0) > 0:
                item = inv_item
                if inv_item.get("variants"):
                    variant_name = inv_item["variants"][0]["name"]
                    price = inv_item["variants"][0]["price"]
                else:
                    price = inv_item.get("price", 10.0)
                break

        if not item:
            pytest.skip("No inventory items with stock available")
        
        # Create order for driver1
        order_data = {
            "address": f"TEST_Driver1_Order_ForDriver2Test_{uuid.uuid4().hex[:8]}",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": price,
                "quantity": 1,
                "variant_name": variant_name,
                "is_free_gift": False
            }],
            "total": price,
            "order_type": "delivery",
            "driver_id": driver1_data["user"]["id"],
            "driver_name": driver1_data["user"]["username"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", headers=headers_service, json=order_data)
        assert create_response.status_code in [200, 201], f"Failed to create order: {create_response.text}"
        order = create_response.json()
        
        # Driver2 tries to complete driver1's order - should fail with 403
        response = requests.put(f"{BASE_URL}/api/orders/{order['id']}/complete", headers=headers_driver2)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}: {response.text}"
        print(f"Driver2 correctly blocked from completing driver1's order (403)")


class TestFinanceCenterAPI:
    """Test Finance Center (Ledger) API with filters"""
    
    @pytest.fixture(scope="class")
    def boss_token(self):
        """Get boss token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss",
            "password": "boss123"
        })
        return response.json()["access_token"]
    
    def test_ledger_get_all(self, boss_token):
        """GET /api/ledger returns transactions"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Ledger returned {len(data)} transactions")
    
    def test_ledger_filter_by_type_orders(self, boss_token):
        """GET /api/ledger?type=orders filters by orders"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger?type=orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All entries should be orders
        for entry in data:
            assert entry["type"] == "order", f"Expected order type, got {entry['type']}"
        print(f"Ledger orders filter returned {len(data)} entries")
    
    def test_ledger_filter_by_type_deposits(self, boss_token):
        """GET /api/ledger?type=deposits filters by deposits"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger?type=deposits", headers=headers)
        assert response.status_code == 200
        data = response.json()
        # All entries should be deposits
        for entry in data:
            assert entry["type"] == "deposit", f"Expected deposit type, got {entry['type']}"
        print(f"Ledger deposits filter returned {len(data)} entries")
    
    def test_ledger_filter_by_driver(self, boss_token):
        """GET /api/ledger?driver_id=X filters by driver"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        # Get drivers first
        drivers_response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = drivers_response.json()
        
        if not drivers:
            pytest.skip("No drivers available")
        
        driver_id = drivers[0]["id"]
        response = requests.get(f"{BASE_URL}/api/ledger?driver_id={driver_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # All entries should be for this driver
        for entry in data:
            if entry.get("driver_id"):
                assert entry["driver_id"] == driver_id
        print(f"Ledger driver filter returned {len(data)} entries for driver {drivers[0]['username']}")
    
    def test_ledger_filter_by_date_range(self, boss_token):
        """GET /api/ledger with date_from and date_to"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(
            f"{BASE_URL}/api/ledger?date_from=2024-01-01&date_to=2030-12-31",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"Ledger date range filter returned {len(data)} entries")
    
    def test_ledger_search(self, boss_token):
        """GET /api/ledger with search parameter"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/ledger?search=driver", headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"Ledger search returned {len(data)} entries")


class TestPaymentsAPI:
    """Test Payments API (approve/reject)"""
    
    @pytest.fixture(scope="class")
    def boss_token(self):
        """Get boss token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss",
            "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def driver_token(self):
        """Get driver token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_driver_submit_payment(self, driver_token):
        """Driver can submit a payment"""
        headers = {"Authorization": f"Bearer {driver_token}"}
        response = requests.post(f"{BASE_URL}/api/payments", headers=headers, json={
            "amount": 25.00
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["amount"] == 25.00
        assert data["status"] == "pending"
        print(f"Driver submitted payment: ${data['amount']}")
        return data
    
    def test_get_pending_payments(self, boss_token):
        """Boss can get pending payments"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/payments?status=pending", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} pending payments")
        return data
    
    def test_approve_payment(self, boss_token, driver_token):
        """Boss can approve a payment"""
        # First create a payment
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        create_response = requests.post(f"{BASE_URL}/api/payments", headers=driver_headers, json={
            "amount": 15.00
        })
        payment = create_response.json()
        
        # Boss approves it
        boss_headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.put(f"{BASE_URL}/api/payments/{payment['id']}/approve", headers=boss_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        print(f"Boss approved payment: ${data['amount']}")
    
    def test_reject_payment(self, boss_token, driver_token):
        """Boss can reject a payment"""
        # First create a payment
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        create_response = requests.post(f"{BASE_URL}/api/payments", headers=driver_headers, json={
            "amount": 10.00
        })
        payment = create_response.json()
        
        # Boss rejects it
        boss_headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.put(f"{BASE_URL}/api/payments/{payment['id']}/reject", headers=boss_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        print(f"Boss rejected payment: ${data['amount']}")


class TestBossStatsAPI:
    """Test Boss Stats API (pending_payments, pending_collections)"""
    
    @pytest.fixture(scope="class")
    def boss_token(self):
        """Get boss token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss",
            "password": "boss123"
        })
        return response.json()["access_token"]
    
    def test_boss_stats_structure(self, boss_token):
        """GET /api/stats/boss returns expected structure"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/boss", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "pending_revenue" in data
        assert "total_revenue" in data
        assert "total_staff_payments" in data
        assert "net_profit" in data
        assert "total_collected" in data
        assert "pending_collections" in data
        assert "pending_payments" in data
        assert "total_orders" in data
        assert "pending_count" in data
        assert "completed_count" in data
        
        print(f"Boss stats: net_profit=${data['net_profit']}, pending_payments={len(data['pending_payments'])}")
    
    def test_boss_stats_pending_collections_structure(self, boss_token):
        """pending_collections has correct structure"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/boss", headers=headers)
        data = response.json()
        
        for collection in data["pending_collections"]:
            assert "driver_id" in collection
            assert "driver_name" in collection
            assert "amount" in collection
            assert "total_sales" in collection
            assert "driver_earnings" in collection
        
        print(f"Found {len(data['pending_collections'])} drivers with pending collections")
    
    def test_boss_stats_pending_payments_structure(self, boss_token):
        """pending_payments has correct structure"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/boss", headers=headers)
        data = response.json()
        
        for payment in data["pending_payments"]:
            assert "id" in payment
            assert "driver_id" in payment
            assert "driver_name" in payment
            assert "amount" in payment
            assert "status" in payment
            assert payment["status"] == "pending"
        
        print(f"Found {len(data['pending_payments'])} pending payments in boss stats")


class TestDriverStatsAPI:
    """Test Driver Stats API"""
    
    @pytest.fixture(scope="class")
    def driver_token(self):
        """Get driver token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_driver_stats_structure(self, driver_token):
        """GET /api/stats/driver returns expected structure"""
        headers = {"Authorization": f"Bearer {driver_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/driver", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "payment_method" in data
        assert "total_sales" in data
        assert "earnings" in data
        assert "pending_to_boss" in data
        assert "pending_count" in data
        
        print(f"Driver stats: total_sales=${data['total_sales']}, earnings=${data['earnings']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
