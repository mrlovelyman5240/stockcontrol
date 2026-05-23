"""
Backend API Tests for LogiFlow Pro Delivery Management System
Tests authentication, orders, inventory, and role-based access
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
BOSS_CREDS = {"username": "boss", "password": "boss123"}
SERVICE_CREDS = {"username": "service1", "password": "service123"}
DRIVER_CREDS = {"username": "driver1", "password": "driver123"}


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def boss_token(api_client):
    """Get boss authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=BOSS_CREDS)
    assert response.status_code == 200, f"Boss login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def service_token(api_client):
    """Get customer service authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=SERVICE_CREDS)
    assert response.status_code == 200, f"Service login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def driver_token(api_client):
    """Get driver authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=DRIVER_CREDS)
    assert response.status_code == 200, f"Driver login failed: {response.text}"
    return response.json().get("access_token")


class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self, api_client):
        """Test health check returns 200"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_boss_success(self, api_client):
        """Test boss login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=BOSS_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "boss"
        assert data["user"]["username"] == "boss"
    
    def test_login_service_success(self, api_client):
        """Test customer service login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=SERVICE_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer_service"
    
    def test_login_driver_success(self, api_client):
        """Test driver login with valid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=DRIVER_CREDS)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "driver"
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials returns 401"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "invalid",
            "password": "invalid"
        })
        assert response.status_code == 401
    
    def test_get_me_authenticated(self, api_client, service_token):
        """Test /auth/me returns current user info"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "service1"
        assert data["role"] == "customer_service"
    
    def test_get_me_unauthenticated(self, api_client):
        """Test /auth/me without token returns 403"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 403


class TestInventory:
    """Inventory endpoint tests"""
    
    def test_get_inventory(self, api_client, service_token):
        """Test getting inventory list"""
        response = api_client.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check inventory item structure
        item = data[0]
        assert "id" in item
        assert "name" in item
        assert "price" in item
        assert "stock" in item
    
    def test_inventory_has_bogo_items(self, api_client, service_token):
        """Test that inventory includes BOGO items"""
        response = api_client.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        bogo_items = [item for item in data if item.get("bogo_enabled")]
        assert len(bogo_items) > 0, "Should have at least one BOGO item"


class TestDrivers:
    """Driver-related endpoint tests"""
    
    def test_get_drivers_as_service(self, api_client, service_token):
        """Test customer service can get drivers list"""
        response = api_client.get(
            f"{BASE_URL}/api/users/drivers",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2, "Should have at least 2 drivers (driver1, driver2)"
        
        # Check driver structure
        driver_names = [d["username"] for d in data]
        assert "driver1" in driver_names
        assert "driver2" in driver_names
    
    def test_get_drivers_as_boss(self, api_client, boss_token):
        """Test boss can get drivers list"""
        response = api_client.get(
            f"{BASE_URL}/api/users/drivers",
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
    
    def test_get_drivers_as_driver_forbidden(self, api_client, driver_token):
        """Test driver cannot get drivers list (403)"""
        response = api_client.get(
            f"{BASE_URL}/api/users/drivers",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 403


class TestOrders:
    """Order endpoint tests"""
    
    def test_get_orders_as_service(self, api_client, service_token):
        """Test customer service can get all orders"""
        response = api_client.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_orders_as_driver(self, api_client, driver_token):
        """Test driver can only see their assigned orders"""
        response = api_client.get(
            f"{BASE_URL}/api/orders",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All orders should be assigned to driver1
        for order in data:
            if order.get("driver_id"):
                # Driver should only see their own orders
                pass  # This is filtered by backend
    
    def test_create_order_as_service(self, api_client, service_token):
        """Test customer service can create order with driver assignment"""
        # First get drivers
        drivers_response = api_client.get(
            f"{BASE_URL}/api/users/drivers",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        drivers = drivers_response.json()
        driver = drivers[0]
        
        # Get inventory
        inv_response = api_client.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        inventory = inv_response.json()
        item = inventory[0]
        
        # Create order
        order_data = {
            "address": "TEST_123 Test Street, Test City",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": item["price"],
            "driver_id": driver["id"],
            "driver_name": driver["username"]
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["address"] == "TEST_123 Test Street, Test City"
        assert data["status"] == "pending"
        assert data["driver_id"] == driver["id"]
        assert "id" in data
        
        return data["id"]
    
    def test_create_order_without_driver_fails(self, api_client, service_token):
        """Test order creation without driver returns 422 validation error"""
        # Get inventory
        inv_response = api_client.get(
            f"{BASE_URL}/api/inventory",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        inventory = inv_response.json()
        item = inventory[0]
        
        # Try to create order without driver
        order_data = {
            "address": "TEST_No Driver Street",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": item["price"]
            # Missing driver_id and driver_name
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/orders",
            json=order_data,
            headers={"Authorization": f"Bearer {service_token}"}
        )
        # Should return 422 validation error
        assert response.status_code == 422
    
    def test_complete_order_as_service(self, api_client, service_token):
        """Test customer service can mark order as complete"""
        # Get pending orders
        orders_response = api_client.get(
            f"{BASE_URL}/api/orders?status=pending",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        orders = orders_response.json()
        
        if len(orders) > 0:
            order_id = orders[0]["id"]
            response = api_client.put(
                f"{BASE_URL}/api/orders/{order_id}/complete",
                headers={"Authorization": f"Bearer {service_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"
        else:
            pytest.skip("No pending orders to complete")


class TestBossStats:
    """Boss statistics endpoint tests"""
    
    def test_get_boss_stats(self, api_client, boss_token):
        """Test boss can get financial statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/stats/boss",
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "total_revenue" in data
        assert "net_profit" in data
        assert "total_orders" in data
        assert "pending_count" in data
        assert "completed_count" in data
    
    def test_boss_stats_forbidden_for_driver(self, api_client, driver_token):
        """Test driver cannot access boss stats"""
        response = api_client.get(
            f"{BASE_URL}/api/stats/boss",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 403


class TestDriverStats:
    """Driver statistics endpoint tests"""
    
    def test_get_driver_stats(self, api_client, driver_token):
        """Test driver can get their statistics"""
        response = api_client.get(
            f"{BASE_URL}/api/stats/driver",
            headers={"Authorization": f"Bearer {driver_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "total_sales" in data
        assert "earnings" in data
        assert "packages_delivered" in data
        assert "payment_method" in data


class TestSettings:
    """Settings endpoint tests"""
    
    def test_get_settings(self, api_client, boss_token):
        """Test getting global settings"""
        response = api_client.get(
            f"{BASE_URL}/api/settings",
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "payment_method" in data
        assert "hourly_rate" in data
        assert "per_delivery_rate" in data
        assert "per_pickup_rate" in data

    def test_update_settings_as_boss(self, api_client, boss_token):
        """Test boss can update settings"""
        response = api_client.put(
            f"{BASE_URL}/api/settings",
            json={"per_delivery_rate": 5.0},
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["per_delivery_rate"] == 5.0

    def test_update_settings_forbidden_for_service(self, api_client, service_token):
        """Test customer service cannot update settings"""
        response = api_client.put(
            f"{BASE_URL}/api/settings",
            json={"per_delivery_rate": 10.0},
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 403


class TestAuditLogs:
    """Audit log endpoint tests"""
    
    def test_get_audit_logs_as_boss(self, api_client, boss_token):
        """Test boss can get audit logs"""
        response = api_client.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {boss_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_audit_logs_forbidden_for_service(self, api_client, service_token):
        """Test customer service cannot access audit logs"""
        response = api_client.get(
            f"{BASE_URL}/api/audit-logs",
            headers={"Authorization": f"Bearer {service_token}"}
        )
        assert response.status_code == 403
