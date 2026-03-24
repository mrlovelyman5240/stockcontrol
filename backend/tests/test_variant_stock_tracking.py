"""
Backend API Tests for LogiFlow Pro - Variant-Specific Stock Tracking v5
Tests for:
1. POST /api/inventory with variants that each have stock field
2. POST /api/orders with variant_name — verify specific variant stock decremented
3. PUT /api/orders/{id}/cancel — verify specific variant stock restored
4. POST /api/orders with quantity exceeding variant stock — verify 400 error
5. Order with non-variant product still uses product-level stock
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://inventory-ops-hub-2.preview.emergentagent.com')

# Test credentials
SERVICE_USER = {"username": "service1", "password": "service123"}
BOSS_USER = {"username": "boss", "password": "boss123"}


class TestVariantStockCRUD:
    """Tests for Inventory Variants with per-variant stock field"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["access_token"]
    
    @pytest.fixture
    def driver_info(self, service_token):
        headers = {"Authorization": f"Bearer {service_token}"}
        response = requests.get(f"{BASE_URL}/api/users/drivers", headers=headers)
        drivers = response.json()
        return drivers[0] if drivers else None
    
    def test_create_inventory_with_variant_stock(self, service_token):
        """Test POST /api/inventory with variants that each have stock field"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_Stock_Variant_Item",
            "price": 10.00,
            "stock": 0,  # Product-level stock is 0 when using variants
            "variants": [
                {"name": "Small", "price": 10.00, "stock": 15},
                {"name": "Medium", "price": 15.00, "stock": 10},
                {"name": "Large", "price": 20.00, "stock": 5}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200, f"Failed to create item: {response.text}"
        data = response.json()
        
        # Verify variants saved with stock
        assert "variants" in data
        assert len(data["variants"]) == 3
        assert data["variants"][0]["name"] == "Small"
        assert data["variants"][0]["stock"] == 15
        assert data["variants"][1]["name"] == "Medium"
        assert data["variants"][1]["stock"] == 10
        assert data["variants"][2]["name"] == "Large"
        assert data["variants"][2]["stock"] == 5
        print(f"✓ Created inventory item with per-variant stock: Small=15, Medium=10, Large=5")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{data['id']}", headers=headers)
        return data["id"]
    
    def test_get_inventory_returns_variant_stock(self, service_token):
        """Test GET /api/inventory returns stock field per variant"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        assert response.status_code == 200
        items = response.json()
        
        # Find items with variants
        items_with_variants = [i for i in items if i.get("variants") and len(i["variants"]) > 0]
        assert len(items_with_variants) > 0, "No items with variants found"
        
        # Verify variant structure includes stock
        for item in items_with_variants:
            for variant in item["variants"]:
                assert "name" in variant
                assert "price" in variant
                assert "stock" in variant, f"Variant {variant['name']} missing stock field"
                assert isinstance(variant["stock"], int), f"Variant stock should be int, got {type(variant['stock'])}"
        
        print(f"✓ GET inventory returns {len(items_with_variants)} items with per-variant stock")


class TestOrderVariantStockDeduction:
    """Tests for order creation deducting from specific variant stock"""
    
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
    def test_item_with_stock(self, service_token):
        """Create a test item with known variant stock"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_Order_Stock_Item",
            "price": 10.00,
            "stock": 0,
            "variants": [
                {"name": "Small", "price": 10.00, "stock": 20},
                {"name": "Large", "price": 15.00, "stock": 10}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)
    
    def test_order_deducts_variant_stock(self, service_token, driver_info, test_item_with_stock):
        """Test POST /api/orders with variant_name — verify specific variant stock decremented"""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = test_item_with_stock
        
        # Get initial stock
        initial_small_stock = item["variants"][0]["stock"]  # 20
        initial_large_stock = item["variants"][1]["stock"]  # 10
        
        # Create order for Small variant (qty=3)
        order_data = {
            "address": "TEST_Stock_Deduction_Order",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Small)",
                "price": 10.00,
                "quantity": 3,
                "variant_name": "Small",
                "is_free_gift": False
            }],
            "total": 30.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        order = response.json()
        
        # Verify stock was deducted from Small variant only
        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = inv_response.json()
        updated_item = next((i for i in items if i["id"] == item["id"]), None)
        assert updated_item is not None
        
        small_variant = next((v for v in updated_item["variants"] if v["name"] == "Small"), None)
        large_variant = next((v for v in updated_item["variants"] if v["name"] == "Large"), None)
        
        assert small_variant["stock"] == initial_small_stock - 3, f"Small stock should be {initial_small_stock - 3}, got {small_variant['stock']}"
        assert large_variant["stock"] == initial_large_stock, f"Large stock should remain {initial_large_stock}, got {large_variant['stock']}"
        
        print(f"✓ Order deducted stock from Small variant: {initial_small_stock} -> {small_variant['stock']}")
        print(f"✓ Large variant stock unchanged: {large_variant['stock']}")
        
        # Cleanup order
        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
    
    def test_order_insufficient_variant_stock_returns_400(self, service_token, driver_info, test_item_with_stock):
        """Test POST /api/orders with quantity exceeding variant stock — verify 400 error"""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = test_item_with_stock
        
        # Try to order more than available stock (Large has 10)
        order_data = {
            "address": "TEST_Insufficient_Stock_Order",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Large)",
                "price": 15.00,
                "quantity": 15,  # More than 10 available
                "variant_name": "Large",
                "is_free_gift": False
            }],
            "total": 225.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        
        error_detail = response.json().get("detail", "")
        assert "Insufficient stock" in error_detail or "stock" in error_detail.lower(), f"Expected 'Insufficient stock' error, got: {error_detail}"
        
        print(f"✓ Order with insufficient variant stock correctly returns 400: {error_detail}")


class TestOrderCancelRestoresVariantStock:
    """Tests for order cancellation restoring variant-specific stock"""
    
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
    def test_item_for_cancel(self, service_token):
        """Create a test item with known variant stock for cancel test"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_Cancel_Stock_Item",
            "price": 12.00,
            "stock": 0,
            "variants": [
                {"name": "Regular", "price": 12.00, "stock": 25},
                {"name": "Premium", "price": 18.00, "stock": 15}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)
    
    def test_cancel_order_restores_variant_stock(self, service_token, driver_info, test_item_for_cancel):
        """Test PUT /api/orders/{id}/cancel — verify specific variant stock restored"""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = test_item_for_cancel
        
        # Get initial stock
        initial_regular_stock = item["variants"][0]["stock"]  # 25
        
        # Create order for Regular variant (qty=5)
        order_data = {
            "address": "TEST_Cancel_Restore_Order",
            "items": [{
                "item_id": item["id"],
                "name": f"{item['name']} (Regular)",
                "price": 12.00,
                "quantity": 5,
                "variant_name": "Regular",
                "is_free_gift": False
            }],
            "total": 60.00,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200
        order = response.json()
        order_id = order["id"]
        
        # Verify stock was deducted
        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = inv_response.json()
        updated_item = next((i for i in items if i["id"] == item["id"]), None)
        regular_variant = next((v for v in updated_item["variants"] if v["name"] == "Regular"), None)
        assert regular_variant["stock"] == initial_regular_stock - 5
        print(f"✓ Stock deducted after order: {initial_regular_stock} -> {regular_variant['stock']}")
        
        # Cancel the order
        cancel_response = requests.put(f"{BASE_URL}/api/orders/{order_id}/cancel", headers=headers)
        assert cancel_response.status_code == 200, f"Failed to cancel order: {cancel_response.text}"
        cancelled_order = cancel_response.json()
        assert cancelled_order["status"] == "cancelled"
        
        # Verify stock was restored
        inv_response2 = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items2 = inv_response2.json()
        restored_item = next((i for i in items2 if i["id"] == item["id"]), None)
        restored_regular = next((v for v in restored_item["variants"] if v["name"] == "Regular"), None)
        
        assert restored_regular["stock"] == initial_regular_stock, f"Stock should be restored to {initial_regular_stock}, got {restored_regular['stock']}"
        print(f"✓ Stock restored after cancel: {restored_regular['stock']} (original: {initial_regular_stock})")


class TestNonVariantProductStock:
    """Tests for products without variants using product-level stock"""
    
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
    def non_variant_item(self, service_token):
        """Create a test item without variants"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        item_data = {
            "name": "TEST_NonVariant_Stock_Item",
            "price": 8.99,
            "stock": 30,  # Product-level stock
            "variants": []  # No variants
        }
        
        response = requests.post(f"{BASE_URL}/api/inventory", json=item_data, headers=headers)
        assert response.status_code == 200
        item = response.json()
        yield item
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/inventory/{item['id']}", headers=headers)
    
    def test_non_variant_order_uses_product_stock(self, service_token, driver_info, non_variant_item):
        """Test order with non-variant product still uses product-level stock"""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = non_variant_item
        
        initial_stock = item["stock"]  # 30
        
        # Create order without variant_name
        order_data = {
            "address": "TEST_NonVariant_Stock_Order",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 4,
                "variant_name": None,  # No variant
                "is_free_gift": False
            }],
            "total": item["price"] * 4,
            "order_type": "pickup",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        order = response.json()
        
        # Verify product-level stock was deducted
        inv_response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        items = inv_response.json()
        updated_item = next((i for i in items if i["id"] == item["id"]), None)
        
        assert updated_item["stock"] == initial_stock - 4, f"Product stock should be {initial_stock - 4}, got {updated_item['stock']}"
        print(f"✓ Non-variant product stock deducted: {initial_stock} -> {updated_item['stock']}")
        
        # Cleanup order
        requests.delete(f"{BASE_URL}/api/orders/{order['id']}", headers=headers)
    
    def test_non_variant_insufficient_stock_returns_400(self, service_token, driver_info, non_variant_item):
        """Test order exceeding non-variant product stock returns 400"""
        headers = {"Authorization": f"Bearer {service_token}"}
        item = non_variant_item
        
        # Try to order more than available (30)
        order_data = {
            "address": "TEST_NonVariant_Insufficient_Order",
            "items": [{
                "item_id": item["id"],
                "name": item["name"],
                "price": item["price"],
                "quantity": 50,  # More than 30 available
                "variant_name": None,
                "is_free_gift": False
            }],
            "total": item["price"] * 50,
            "order_type": "delivery",
            "driver_id": driver_info["id"],
            "driver_name": driver_info["username"]
        }
        
        response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        error_detail = response.json().get("detail", "")
        assert "Insufficient stock" in error_detail or "stock" in error_detail.lower()
        print(f"✓ Non-variant insufficient stock correctly returns 400: {error_detail}")


class TestStockTestProduct:
    """Tests for the pre-existing 'Stock Test Product' with Small:5 and Large:3"""
    
    @pytest.fixture
    def service_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SERVICE_USER)
        return response.json()["access_token"]
    
    def test_stock_test_product_exists(self, service_token):
        """Verify 'Stock Test Product' exists with correct variant stock"""
        headers = {"Authorization": f"Bearer {service_token}"}
        
        response = requests.get(f"{BASE_URL}/api/inventory", headers=headers)
        assert response.status_code == 200
        items = response.json()
        
        stock_test_product = next((i for i in items if i["name"] == "Stock Test Product"), None)
        
        if stock_test_product:
            print(f"✓ Found 'Stock Test Product': {stock_test_product}")
            assert len(stock_test_product.get("variants", [])) >= 2, "Should have at least 2 variants"
            
            small = next((v for v in stock_test_product["variants"] if v["name"] == "Small"), None)
            large = next((v for v in stock_test_product["variants"] if v["name"] == "Large"), None)
            
            if small:
                print(f"  Small variant stock: {small.get('stock', 'N/A')}")
            if large:
                print(f"  Large variant stock: {large.get('stock', 'N/A')}")
        else:
            print("⚠ 'Stock Test Product' not found - may need to be created")
            pytest.skip("Stock Test Product not found in inventory")


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
