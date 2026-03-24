"""
Test suite for new features in LogiFlow Pro:
- Staff Hours (Boss/CS logging hours for drivers)
- Financial Ledger
- Driver Hours API
- Payments API
- Photo Upload API
- Audit Logs API
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    def test_boss_login(self):
        """Test boss login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss",
            "password": "boss123"
        })
        assert response.status_code == 200, f"Boss login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "boss"
        print(f"✓ Boss login successful")
        return data["access_token"]
    
    def test_service_login(self):
        """Test customer service login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "service1",
            "password": "service123"
        })
        assert response.status_code == 200, f"Service login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer_service"
        print(f"✓ Customer service login successful")
        return data["access_token"]
    
    def test_driver_login(self):
        """Test driver login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1",
            "password": "driver123"
        })
        assert response.status_code == 200, f"Driver login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "driver"
        print(f"✓ Driver login successful")
        return data["access_token"]


class TestDriverHoursAPI:
    """Test /api/driver-hours endpoints"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "service1", "password": "service123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_id(self, boss_token):
        """Get driver1's ID"""
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        drivers = response.json()
        driver1 = next((d for d in drivers if d["username"] == "driver1"), None)
        assert driver1 is not None, "driver1 not found"
        return driver1["id"]
    
    def test_get_driver_hours_empty(self, boss_token):
        """Test GET /api/driver-hours returns list"""
        response = requests.get(f"{BASE_URL}/api/driver-hours", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ GET /api/driver-hours returns list")
    
    def test_boss_can_log_hours(self, boss_token, driver_id):
        """Test boss can log hours for a driver"""
        test_date = f"2026-03-{datetime.now().day:02d}"
        response = requests.post(f"{BASE_URL}/api/driver-hours", 
            headers={"Authorization": f"Bearer {boss_token}"},
            json={
                "driver_id": driver_id,
                "date": test_date,
                "hours": 8.5
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["hours"] == 8.5
        assert data["driver_id"] == driver_id
        print(f"✓ Boss can log hours for driver")
    
    def test_service_can_log_hours(self, service_token, driver_id):
        """Test customer service can log hours for a driver"""
        test_date = f"2026-03-{(datetime.now().day + 1) % 28 + 1:02d}"
        response = requests.post(f"{BASE_URL}/api/driver-hours", 
            headers={"Authorization": f"Bearer {service_token}"},
            json={
                "driver_id": driver_id,
                "date": test_date,
                "hours": 6.0
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["hours"] == 6.0
        print(f"✓ Customer service can log hours for driver")
    
    def test_driver_cannot_log_hours(self, driver_token, driver_id):
        """Test driver cannot log hours (403)"""
        response = requests.post(f"{BASE_URL}/api/driver-hours", 
            headers={"Authorization": f"Bearer {driver_token}"},
            json={
                "driver_id": driver_id,
                "date": "2026-03-15",
                "hours": 5.0
            }
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Driver cannot log hours (403 Forbidden)")
    
    def test_filter_hours_by_driver(self, boss_token, driver_id):
        """Test filtering hours by driver_id"""
        response = requests.get(f"{BASE_URL}/api/driver-hours", 
            headers={"Authorization": f"Bearer {boss_token}"},
            params={"driver_id": driver_id}
        )
        assert response.status_code == 200
        hours = response.json()
        for h in hours:
            assert h["driver_id"] == driver_id
        print(f"✓ Filter hours by driver_id works")


class TestLedgerAPI:
    """Test /api/ledger endpoint"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_get_ledger_boss_only(self, boss_token):
        """Test GET /api/ledger returns ledger entries"""
        response = requests.get(f"{BASE_URL}/api/ledger", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/ledger returns list ({len(data)} entries)")
    
    def test_ledger_driver_forbidden(self, driver_token):
        """Test driver cannot access ledger"""
        response = requests.get(f"{BASE_URL}/api/ledger", headers={
            "Authorization": f"Bearer {driver_token}"
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Driver cannot access ledger (403 Forbidden)")
    
    def test_ledger_filter_by_type(self, boss_token):
        """Test ledger filter by type"""
        for type_filter in ["orders", "deposits", "hours"]:
            response = requests.get(f"{BASE_URL}/api/ledger", 
                headers={"Authorization": f"Bearer {boss_token}"},
                params={"type": type_filter}
            )
            assert response.status_code == 200, f"Failed for type={type_filter}: {response.text}"
            data = response.json()
            # Verify all entries match the type
            for entry in data:
                if type_filter == "orders":
                    assert entry["type"] == "order"
                elif type_filter == "deposits":
                    assert entry["type"] == "deposit"
                elif type_filter == "hours":
                    assert entry["type"] == "hours"
        print(f"✓ Ledger filter by type works")


class TestPaymentsAPI:
    """Test /api/payments endpoints"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_driver_submit_payment(self, driver_token):
        """Test driver can submit payment"""
        response = requests.post(f"{BASE_URL}/api/payments", 
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"amount": 50.00}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["amount"] == 50.00
        assert data["status"] == "pending"
        print(f"✓ Driver can submit payment")
        return data["id"]
    
    def test_get_payments(self, boss_token):
        """Test GET /api/payments"""
        response = requests.get(f"{BASE_URL}/api/payments", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ GET /api/payments returns list")
    
    def test_boss_approve_payment(self, boss_token, driver_token):
        """Test boss can approve payment"""
        # First create a payment
        create_resp = requests.post(f"{BASE_URL}/api/payments", 
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"amount": 25.00}
        )
        payment_id = create_resp.json()["id"]
        
        # Approve it
        response = requests.put(f"{BASE_URL}/api/payments/{payment_id}/approve", 
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "approved"
        print(f"✓ Boss can approve payment")
    
    def test_boss_reject_payment(self, boss_token, driver_token):
        """Test boss can reject payment"""
        # First create a payment
        create_resp = requests.post(f"{BASE_URL}/api/payments", 
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"amount": 15.00}
        )
        payment_id = create_resp.json()["id"]
        
        # Reject it
        response = requests.put(f"{BASE_URL}/api/payments/{payment_id}/reject", 
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["status"] == "rejected"
        print(f"✓ Boss can reject payment")


class TestAuditLogsAPI:
    """Test /api/audit-logs endpoint"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_get_audit_logs_boss(self, boss_token):
        """Test boss can access audit logs"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ Boss can access audit logs")
    
    def test_audit_logs_driver_forbidden(self, driver_token):
        """Test driver cannot access audit logs"""
        response = requests.get(f"{BASE_URL}/api/audit-logs", headers={
            "Authorization": f"Bearer {driver_token}"
        })
        assert response.status_code == 403
        print(f"✓ Driver cannot access audit logs (403)")


class TestPhotoUploadAPI:
    """Test photo upload endpoints"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "service1", "password": "service123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_order_id(self, service_token, boss_token):
        """Create a test order and complete it"""
        # Get drivers
        drivers_resp = requests.get(f"{BASE_URL}/api/users/drivers", headers={
            "Authorization": f"Bearer {service_token}"
        })
        driver = drivers_resp.json()[0]
        
        # Get inventory
        inv_resp = requests.get(f"{BASE_URL}/api/inventory", headers={
            "Authorization": f"Bearer {service_token}"
        })
        item = inv_resp.json()[0]
        
        # Handle variants - use first variant if available
        variant = item.get("variants", [{}])[0] if item.get("variants") else None
        price = variant.get("price", item["price"]) if variant else item["price"]
        variant_name = variant.get("name") if variant else None
        
        # Create order with variant if available
        order_item = {
            "item_id": item["id"], 
            "name": item["name"], 
            "price": price, 
            "quantity": 1
        }
        if variant_name:
            order_item["variant_name"] = variant_name
        
        order_resp = requests.post(f"{BASE_URL}/api/orders", 
            headers={"Authorization": f"Bearer {service_token}"},
            json={
                "address": "TEST Photo Upload Address",
                "items": [order_item],
                "total": price,
                "order_type": "delivery",
                "driver_id": driver["id"],
                "driver_name": driver["username"]
            }
        )
        
        if order_resp.status_code != 200:
            pytest.skip(f"Could not create order: {order_resp.text}")
        
        order_id = order_resp.json()["id"]
        
        # Complete the order
        requests.put(f"{BASE_URL}/api/orders/{order_id}/complete", headers={
            "Authorization": f"Bearer {service_token}"
        })
        
        return order_id
    
    def test_upload_photo_to_order(self, driver_token, test_order_id):
        """Test uploading photo to an order"""
        # Create a simple test image (1x1 pixel PNG)
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/orders/{test_order_id}/photo",
            headers={"Authorization": f"Bearer {driver_token}"},
            files=files
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert "storage_path" in data
        print(f"✓ Photo upload to order works")
        return data["id"]
    
    def test_get_order_photos(self, driver_token, test_order_id):
        """Test getting photos for an order"""
        response = requests.get(
            f"{BASE_URL}/api/orders/{test_order_id}/photos",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        assert isinstance(response.json(), list)
        print(f"✓ GET /api/orders/{test_order_id}/photos works")
    
    def test_get_photo_by_id(self, driver_token, test_order_id):
        """Test getting photo by ID"""
        # First upload a photo
        import base64
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test2.png", png_data, "image/png")}
        upload_resp = requests.post(
            f"{BASE_URL}/api/orders/{test_order_id}/photo",
            headers={"Authorization": f"Bearer {driver_token}"},
            files=files
        )
        photo_id = upload_resp.json()["id"]
        
        # Get the photo
        response = requests.get(
            f"{BASE_URL}/api/photos/{photo_id}",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        assert response.headers.get("Content-Type", "").startswith("image/")
        print(f"✓ GET /api/photos/{photo_id} returns image")


class TestBossStats:
    """Test boss stats endpoint"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "boss", "password": "boss123"
        })
        return response.json()["access_token"]
    
    def test_get_boss_stats(self, boss_token):
        """Test GET /api/stats/boss"""
        response = requests.get(f"{BASE_URL}/api/stats/boss", headers={
            "Authorization": f"Bearer {boss_token}"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "pending_revenue" in data
        assert "total_revenue" in data
        assert "net_profit" in data
        assert "pending_payments" in data
        assert "pending_collections" in data
        print(f"✓ GET /api/stats/boss returns expected fields")


class TestDriverStats:
    """Test driver stats endpoint"""
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "driver1", "password": "driver123"
        })
        return response.json()["access_token"]
    
    def test_get_driver_stats(self, driver_token):
        """Test GET /api/stats/driver"""
        response = requests.get(f"{BASE_URL}/api/stats/driver", headers={
            "Authorization": f"Bearer {driver_token}"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Verify expected fields
        assert "earnings" in data
        assert "total_sales" in data
        assert "pending_to_boss" in data
        assert "payment_method" in data
        print(f"✓ GET /api/stats/driver returns expected fields")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
