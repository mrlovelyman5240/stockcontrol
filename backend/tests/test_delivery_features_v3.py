"""
Backend API Tests for LogiFlow Pro - Feature Update v3
Tests for:
1. Order Type (Delivery/Pickup) field
2. Free Gift functionality (manual selection, not BOGO)
3. Split rates: per_delivery_rate and per_pickup_rate
4. Cancel order endpoint
5. Cancelled orders excluded from revenue calculations
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://inventory-ops-hub-2.preview.emergentagent.com')

# Test credentials
SERVICE_USER = {"username": "service1", "password": "service123"}
DRIVER_USER = {"username": "driver1", "password": "driver123"}
BOSS_USER = {"username": "boss", "password": "boss123"}


class TestAuth:
    """Authentication tests"""
    
    def test_login_service(self):
        """Test customer service login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "customer_service"
        print(f"✓ Service login successful: {data['user']['username']}")
    
    def test_login_driver(self):
        """Test driver login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DRIVER_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "driver"
        print(f"✓ Driver login successful: {data['user']['username']}")
    
    def test_login_boss(self):
        """Test boss login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "boss"
        print(f"✓ Boss login successful: {data['user']['username']}")


class TestOrderType:
    """Tests for Order Type (Delivery/Pickup) feature"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_info(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = response.json()
        return drivers[0] if drivers else None
    
    @pytest.fixture
    def inventory_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        return items[0] if items else None
    
    def test_create_delivery_order(self, service_token, driver_info, inventory_item):
        """Test creating an order with order_type='delivery'"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        order_data = {
            "address": "TEST_123 Delivery Street",
            "items": [{
                "item_id": inventory_item["id"],
                "name": inventory_item["name"],
                "price": inventory_item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": inventory_item["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["order_type"] == "delivery"
        assert data["status"] == "pending"
        print(f"✓ Created delivery order: {data['id'][:8]}")
        return data["id"]
    
    def test_create_pickup_order(self, service_token, driver_info, inventory_item):
        """Test creating an order with order_type='pickup'"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        order_data = {
            "address": "TEST_456 Pickup Location",
            "items": [{
                "item_id": inventory_item["id"],
                "name": inventory_item["name"],
                "price": inventory_item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": inventory_item["price"],
            "order_type": "pickup",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["order_type"] == "pickup"
        assert data["status"] == "pending"
        print(f"✓ Created pickup order: {data['id'][:8]}")
        return data["id"]
    
    def test_order_type_in_list(self, service_token):
        """Test that order_type is returned in orders list"""
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        orders = response.json()
        
        # Check that orders have order_type field
        for order in orders[:5]:  # Check first 5 orders
            assert "order_type" in order
            assert order["order_type"] in ["delivery", "pickup"]
        print(f"✓ Order type field present in {len(orders)} orders")


class TestFreeGift:
    """Tests for Free Gift functionality"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_info(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = response.json()
        return drivers[0] if drivers else None
    
    @pytest.fixture
    def inventory_items(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        return response.json()
    
    def test_create_order_with_free_gift(self, service_token, driver_info, inventory_items):
        """Test creating an order with a free gift item"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        paid_item = inventory_items[0]
        gift_item = inventory_items[1] if len(inventory_items) > 1 else inventory_items[0]
        
        order_data = {
            "address": "TEST_789 Free Gift Test",
            "items": [
                {
                    "item_id": paid_item["id"],
                    "name": paid_item["name"],
                    "price": paid_item["price"],
                    "quantity": 1,
                    "is_free_gift": False
                },
                {
                    "item_id": gift_item["id"],
                    "name": gift_item["name"],
                    "price": 0,  # Free gift has $0 price
                    "quantity": 1,
                    "is_free_gift": True
                }
            ],
            "total": paid_item["price"],  # Only paid item counts
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify free gift is in items
        free_gifts = [item for item in data["items"] if item.get("is_free_gift")]
        assert len(free_gifts) == 1
        assert free_gifts[0]["price"] == 0
        print(f"✓ Created order with free gift: {data['id'][:8]}")


class TestCancelOrder:
    """Tests for Cancel Order functionality"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_info(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = response.json()
        return drivers[0] if drivers else None
    
    @pytest.fixture
    def inventory_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        return items[0] if items else None
    
    def test_cancel_pending_order(self, service_token, driver_info, inventory_item):
        """Test cancelling a pending order"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # First create an order
        order_data = {
            "address": "TEST_Cancel Order Test",
            "items": [{
                "item_id": inventory_item["id"],
                "name": inventory_item["name"],
                "price": inventory_item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": inventory_item["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert create_response.status_code == 200
        order_id = create_response.json()["id"]
        
        # Now cancel the order
        cancel_response = requests.put(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers)
        assert cancel_response.status_code == 200
        cancelled_order = cancel_response.json()
        assert cancelled_order["status"] == "cancelled"
        print(f"✓ Successfully cancelled order: {order_id[:8]}")
    
    def test_cannot_cancel_completed_order(self, service_token, driver_info, inventory_item):
        """Test that completed orders cannot be cancelled"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # Create and complete an order
        order_data = {
            "address": "TEST_Complete Then Cancel Test",
            "items": [{
                "item_id": inventory_item["id"],
                "name": inventory_item["name"],
                "price": inventory_item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": inventory_item["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        order_id = create_response.json()["id"]
        
        # Complete the order
        complete_response = requests.put(f"{BASE_URL}/api/orders/{order_id}/complete", headers=headers)
        assert complete_response.status_code == 200
        
        # Try to cancel - should fail
        cancel_response = requests.put(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers)
        assert cancel_response.status_code == 400
        print(f"✓ Correctly rejected cancellation of completed order")


class TestSplitRates:
    """Tests for split per_delivery_rate and per_pickup_rate"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    def test_settings_have_split_rates(self, boss_token):
        """Test that settings have per_delivery_rate and per_pickup_rate"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert response.status_code == 200
        settings = response.json()
        
        assert "per_delivery_rate" in settings
        assert "per_pickup_rate" in settings
        assert isinstance(settings["per_delivery_rate"], (int, float))
        assert isinstance(settings["per_pickup_rate"], (int, float))
        print(f"✓ Settings have split rates: delivery=${settings['per_delivery_rate']}, pickup=${settings['per_pickup_rate']}")
    
    def test_update_split_rates(self, boss_token):
        """Test updating per_delivery_rate and per_pickup_rate"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        # Update rates
        update_data = {
            "per_delivery_rate": 6.0,
            "per_pickup_rate": 4.0
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=update_data, headers=headers)
        assert response.status_code == 200
        settings = response.json()
        
        assert settings["per_delivery_rate"] == 6.0
        assert settings["per_pickup_rate"] == 4.0
        print(f"✓ Updated split rates successfully")
        
        # Restore original rates
        restore_data = {
            "per_delivery_rate": 5.0,
            "per_pickup_rate": 3.0
        }
        requests.put(f"{BASE_URL}/api/settings", json=restore_data, headers=headers)


class TestDriverEarningsBreakdown:
    """Tests for driver earnings with delivery/pickup split"""
    
    @pytest.fixture
    def driver_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=DRIVER_USER)
        return response.json()["access_token"]
    
    def test_driver_stats_have_split_counts(self, driver_token):
        """Test that driver stats include deliveries_completed and pickups_completed"""
        headers = {"Authorization": f"Bearer {driver_token}"}
        response = requests.get(f"{BASE_URL}/api/stats/driver", headers=headers)
        assert response.status_code == 200
        stats = response.json()
        
        assert "deliveries_completed" in stats
        assert "pickups_completed" in stats
        assert "per_delivery_rate" in stats
        assert "per_pickup_rate" in stats
        print(f"✓ Driver stats have split counts: {stats['deliveries_completed']} deliveries, {stats['pickups_completed']} pickups")


class TestCancelledOrdersExcludedFromRevenue:
    """Tests that cancelled orders are excluded from revenue calculations"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_info(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = response.json()
        return drivers[0] if drivers else None
    
    @pytest.fixture
    def inventory_item(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        return items[0] if items else None
    
    def test_cancelled_orders_not_in_revenue(self, boss_token, service_token, driver_info, inventory_item):
        """Test that cancelled orders don't count in boss revenue stats"""
        boss_headers = {"Authorization": f"Bearer {boss_token}"}
        service_headers = {"Authorization": f"Bearer {service_token}"}
        
        # Get initial stats
        initial_stats = requests.get(f"{BASE_URL}/api/stats/boss", headers=boss_headers).json()
        initial_revenue = initial_stats["total_revenue"]
        
        # Create an order
        order_data = {
            "address": "TEST_Revenue Exclusion Test",
            "items": [{
                "item_id": inventory_item["id"],
                "name": inventory_item["name"],
                "price": inventory_item["price"],
                "quantity": 1,
                "is_free_gift": False
            }],
            "total": inventory_item["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=service_headers)
        order_id = create_response.json()["id"]
        
        # Cancel the order
        requests.put(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=service_headers)
        
        # Check stats - revenue should not have increased
        final_stats = requests.get(f"{BASE_URL}/api/stats/boss", headers=boss_headers).json()
        final_revenue = final_stats["total_revenue"]
        
        # Revenue should be the same (cancelled orders don't count)
        assert final_revenue == initial_revenue
        print(f"✓ Cancelled orders correctly excluded from revenue (${initial_revenue} -> ${final_revenue})")


class TestInventoryDeletion:
    """Tests for inventory deletion"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    def test_service_can_delete_inventory(self, service_token):
        """Test that customer service can delete inventory items"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # Create a test item
        create_data = {
            "name": "TEST_Delete Item",
            "price": 9.99,
            "stock": 10
        }
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_data, headers=headers)
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Delete the item
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/{item_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✓ Customer service can delete inventory items")
    
    def test_boss_can_delete_inventory(self, boss_token):
        """Test that boss can delete inventory items"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        # Create a test item
        create_data = {
            "name": "TEST_Boss Delete Item",
            "price": 19.99,
            "stock": 5
        }
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_data, headers=headers)
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Delete the item
        delete_response = requests.delete(f"{BASE_URL}/api/inventory/{item_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✓ Boss can delete inventory items")


# Cleanup test data
class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    def test_cleanup_test_orders(self, service_token):
        """Clean up TEST_ prefixed orders"""
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        orders = response.json()
        
        deleted_count = 0
        for order in orders:
            if order["address"].startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test orders")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
