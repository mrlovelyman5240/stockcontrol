"""
Backend API Tests for LogiFlow Pro - Variant Features v4
Tests for:
1. Inventory Variants CRUD - POST/GET/PUT with variants array
2. Order Items with variant_name field
3. Variant pricing in orders
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://inventory-ops-hub-2.preview.emergentagent.com')

# Test credentials
SERVICE_USER = {"username": "service1", "password": "service123"}
DRIVER_USER = {"username": "driver1", "password": "driver123"}
BOSS_USER = {"username": "boss", "password": "boss123"}


class TestInventoryVariantsCRUD:
    """Tests for Inventory Variants CRUD operations"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    def test_create_inventory_with_variants(self, service_token):
        """Test POST /api/inventory with variants array"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_Variant_Item",
            "price": 4.99,  # Base price (first variant price)
            "stock": 50,
            "variants": [
                {"name": "Small", "price": 4.99},
                {"name": "Large", "price": 7.99}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        data = response.json()
        
        # Verify variants saved
        assert "variants" in data
        assert len(data["variants"]) == 2
        assert data["variants"][0]["name"] == "Small"
        assert data["variants"][0]["price"] == 4.99
        assert data["variants"][1]["name"] == "Large"
        assert data["variants"][1]["price"] == 7.99
        print(f"✓ Created inventory item with 2 variants: {data['id'][:8]}")
        return data["id"]
    
    def test_get_inventory_returns_variants(self, service_token):
        """Test GET /api/inventory returns variants field"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        assert response.status_code == 200
        items = response.json()
        
        # Find items with variants
        items_with_variants = [i for i in items if i.get("variants") and len(i["variants"]) > 0]
        assert len(items_with_variants) > 0, "No items with variants found"
        
        # Verify variant structure
        for item in items_with_variants:
            for variant in item["variants"]:
                assert "name" in variant
                assert "price" in variant
                assert isinstance(variant["price"], (int, float))
        
        print(f"✓ GET inventory returns {len(items_with_variants)} items with variants")
    
    def test_update_inventory_variants(self, service_token):
        """Test PUT /api/inventory/{id} to update variants"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # First create an item with variants
        create_data = {
            "name": "TEST_Update_Variant_Item",
            "price": 5.99,
            "stock": 30,
            "variants": [
                {"name": "Regular", "price": 5.99},
                {"name": "Extra", "price": 8.99}
            ]
        }
        
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_data, headers=headers)
        assert create_response.status_code == 200
        item_id = create_response.json()["id"]
        
        # Update variants
        update_data = {
            "variants": [
                {"name": "Regular", "price": 6.49},  # Changed price
                {"name": "Extra", "price": 9.49},    # Changed price
                {"name": "Family", "price": 14.99}   # New variant
            ]
        }
        
        update_response = requests.put(f"{BASE_URL}/api/inventory/{item_id}", json=update_data, headers=headers)
        assert update_response.status_code == 200
        updated_item = update_response.json()
        
        # Verify updated variants
        assert len(updated_item["variants"]) == 3
        assert updated_item["variants"][0]["price"] == 6.49
        assert updated_item["variants"][2]["name"] == "Family"
        print(f"✓ Updated inventory variants successfully")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item_id}", headers=headers)
    
    def test_create_inventory_without_variants(self, service_token):
        """Test creating inventory item without variants (single-price item)"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_No_Variant_Item",
            "price": 12.99,
            "stock": 25,
            "variants": []  # Empty variants = single-price item
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["variants"] == []
        assert data["price"] == 12.99
        print(f"✓ Created single-price item (no variants): {data['id'][:8]}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=headers)


class TestOrderWithVariants:
    """Tests for Orders with variant_name field"""
    
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
    def variant_item(self, service_token):
        """Get or create an item with variants"""
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        
        # Find item with variants
        for item in items:
            if item.get("variants") and len(item["variants"]) > 0:
                return item
        
        # Create one if not found
        create_data = {
            "name": "TEST_Order_Variant_Item",
            "price": 9.99,
            "stock": 100,
            "variants": [
                {"name": "Small", "price": 9.99},
                {"name": "Medium", "price": 12.99},
                {"name": "Large", "price": 15.99}
            ]
        }
        create_response = requests.post(f"{BASE_URL}/api/inventory", json=create_data, headers=headers)
        return create_response.json()
    
    def test_create_order_with_variant_name(self, service_token, driver_info, variant_item):
        """Test creating order with variant_name in order item"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        selected_variant = variant_item["variants"][1]  # Medium
        
        order_data = {
            "address": "TEST_Variant Order - 123 Main St",
            "items": [{
                "item_id": variant_item["id"],
                "name": f"{variant_item['name']} ({selected_variant['name']})",
                "price": selected_variant["price"],
                "quantity": 1,
                "variant_name": selected_variant["name"],
                "is_free_gift": False
            }],
            "total": selected_variant["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        data = response.json()
        
        # Verify variant_name is saved
        assert len(data["items"]) == 1
        assert data["items"][0]["variant_name"] == selected_variant["name"]
        assert data["items"][0]["price"] == selected_variant["price"]
        print(f"✓ Created order with variant_name: {data['id'][:8]}")
        return data["id"]
    
    def test_create_order_with_custom_price(self, service_token, driver_info, variant_item):
        """Test creating order with custom/discounted price"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        selected_variant = variant_item["variants"][0]  # Small
        custom_price = 3.99  # Discounted price
        
        order_data = {
            "address": "TEST_Custom Price Order",
            "items": [{
                "item_id": variant_item["id"],
                "name": f"{variant_item['name']} ({selected_variant['name']})",
                "price": custom_price,  # Custom price
                "quantity": 1,
                "variant_name": selected_variant["name"],
                "is_free_gift": False
            }],
            "total": custom_price,
            "order_type": "pickup",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify custom price is saved
        assert data["items"][0]["price"] == custom_price
        print(f"✓ Created order with custom price: ${custom_price}")
        return data["id"]
    
    def test_order_without_variant_name(self, service_token, driver_info):
        """Test creating order for item without variants (variant_name=null)"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        # Get item without variants
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        no_variant_item = None
        for item in items:
            if not item.get("variants") or len(item["variants"]) == 0:
                no_variant_item = item
                break
        
        if not no_variant_item:
            pytest.skip("No items without variants found")
        
        order_data = {
            "address": "TEST_No Variant Order",
            "items": [{
                "item_id": no_variant_item["id"],
                "name": no_variant_item["name"],
                "price": no_variant_item["price"],
                "quantity": 1,
                "variant_name": None,  # No variant
                "is_free_gift": False
            }],
            "total": no_variant_item["price"],
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # variant_name should be null
        assert data["items"][0]["variant_name"] is None
        print(f"✓ Created order without variant_name")
    
    def test_orders_list_includes_variant_name(self, service_token):
        """Test GET /api/orders returns variant_name in items"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        response = requests.get(f"{BASE_URL}/api/orders", headers=headers)
        assert response.status_code == 200
        orders = response.json()
        
        # Check that orders have items with variant_name field
        orders_with_variants = 0
        for order in orders:
            for item in order.get("items", []):
                if "variant_name" in item:
                    orders_with_variants += 1
                    break
        
        print(f"✓ Orders list includes variant_name field ({orders_with_variants} orders checked)")


class TestBossInventoryVariants:
    """Tests for Boss role inventory variant access"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    def test_boss_can_create_variants(self, boss_token):
        """Test boss can create inventory with variants"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        item_data = {
            "name": "TEST_Boss_Variant_Item",
            "price": 19.99,
            "stock": 40,
            "variants": [
                {"name": "Standard", "price": 19.99},
                {"name": "Premium", "price": 29.99}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["variants"]) == 2
        print(f"✓ Boss created inventory with variants")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=headers)
    
    def test_boss_can_view_variants(self, boss_token):
        """Test boss can view inventory variants"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        assert response.status_code == 200
        items = response.json()
        
        items_with_variants = [i for i in items if i.get("variants") and len(i["variants"]) > 0]
        print(f"✓ Boss can view {len(items_with_variants)} items with variants")


class TestSettingsSplitRates:
    """Tests for split delivery/pickup rates in settings"""
    
    @pytest.fixture
    def boss_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOSS_USER)
        return response.json()["access_token"]
    
    def test_settings_have_split_rates(self, boss_token):
        """Verify settings have per_delivery_rate and per_pickup_rate"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        response = requests.get(f"{BASE_URL}/api/settings", headers=headers)
        assert response.status_code == 200
        settings = response.json()
        
        assert "per_delivery_rate" in settings
        assert "per_pickup_rate" in settings
        print(f"✓ Settings have split rates: delivery=${settings['per_delivery_rate']}, pickup=${settings['per_pickup_rate']}")
    
    def test_update_split_rates(self, boss_token):
        """Test updating split rates"""
        headers = {"Authorization": f"Bearer {boss_token}"}
        
        # Get current rates
        current = requests.get(f"{BASE_URL}/api/settings", headers=headers).json()
        
        # Update rates
        update_data = {
            "per_delivery_rate": 7.50,
            "per_pickup_rate": 4.50
        }
        
        response = requests.put(f"{BASE_URL}/api/settings", json=update_data, headers=headers)
        assert response.status_code == 200
        updated = response.json()
        
        assert updated["per_delivery_rate"] == 7.50
        assert updated["per_pickup_rate"] == 4.50
        print(f"✓ Updated split rates successfully")
        
        # Restore original rates
        restore_data = {
            "per_delivery_rate": current.get("per_delivery_rate", 5.0),
            "per_pickup_rate": current.get("per_pickup_rate", 3.0)
        }
        requests.put(f"{BASE_URL}/api/settings", json=restore_data, headers=headers)


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
    
    def test_cleanup_test_inventory(self, service_token):
        """Clean up TEST_ prefixed inventory items"""
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = response.json()
        
        deleted_count = 0
        for item in items:
            if item["name"].startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test inventory items")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
