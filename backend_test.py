import requests
import sys
from datetime import datetime
import json

class LogiFlowAPITester:
    def __init__(self, base_url="https://driver-earnings-38.preview.emergentagent.com"):
        self.base_url = base_url
        self.boss_token = None
        self.service_token = None
        self.driver_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    result_data = response.json() if response.content else {}
                except:
                    result_data = {"raw_response": response.text}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    result_data = response.json() if response.content else {}
                    print(f"   Response: {result_data}")
                except:
                    result_data = {"error": response.text}

            self.test_results.append({
                "name": name,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "data": result_data
            })

            return success, result_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test API health"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_seed_data(self):
        """Seed demo data"""
        success, response = self.run_test("Seed Demo Data", "POST", "seed", 200)
        return success

    def test_login_boss(self):
        """Test boss login"""
        success, response = self.run_test(
            "Boss Login",
            "POST",
            "auth/login",
            200,
            data={"username": "boss", "password": "boss123"}
        )
        if success and 'access_token' in response:
            self.boss_token = response['access_token']
            print(f"   Boss token acquired: {self.boss_token[:20]}...")
            return True
        return False

    def test_login_service(self):
        """Test customer service login"""
        success, response = self.run_test(
            "Customer Service Login",
            "POST",
            "auth/login",
            200,
            data={"username": "service1", "password": "service123"}
        )
        if success and 'access_token' in response:
            self.service_token = response['access_token']
            print(f"   Service token acquired: {self.service_token[:20]}...")
            return True
        return False

    def test_login_driver(self):
        """Test driver login"""
        success, response = self.run_test(
            "Driver Login",
            "POST",
            "auth/login",
            200,
            data={"username": "driver1", "password": "driver123"}
        )
        if success and 'access_token' in response:
            self.driver_token = response['access_token']
            print(f"   Driver token acquired: {self.driver_token[:20]}...")
            return True
        return False

    def test_boss_stats(self):
        """Test boss dashboard statistics"""
        success, response = self.run_test(
            "Boss Statistics",
            "GET",
            "stats/boss",
            200,
            token=self.boss_token
        )
        if success:
            # Check if stats contain expected fields
            expected_fields = ['total_order_value', 'net_profit', 'pending_collections', 'pending_payments']
            for field in expected_fields:
                if field not in response:
                    print(f"   Warning: Missing field '{field}' in boss stats")
        return success

    def test_driver_stats(self):
        """Test driver statistics"""
        today = datetime.now().strftime('%Y-%m-%d')
        success, response = self.run_test(
            "Driver Statistics",
            "GET",
            f"stats/driver?date={today}",
            200,
            token=self.driver_token
        )
        return success

    def test_inventory_access(self):
        """Test inventory access for different roles"""
        # Boss access
        success_boss, _ = self.run_test(
            "Boss Inventory Access",
            "GET",
            "inventory",
            200,
            token=self.boss_token
        )
        
        # Service access
        success_service, _ = self.run_test(
            "Service Inventory Access",
            "GET",
            "inventory",
            200,
            token=self.service_token
        )
        
        # Driver access
        success_driver, _ = self.run_test(
            "Driver Inventory Access",
            "GET",
            "inventory",
            200,
            token=self.driver_token
        )
        
        return success_boss and success_service and success_driver

    def test_orders_access(self):
        """Test orders access for different roles"""
        # Boss access - can see all orders
        success_boss, boss_orders = self.run_test(
            "Boss Orders Access",
            "GET",
            "orders",
            200,
            token=self.boss_token
        )
        
        # Service access - can see all orders
        success_service, service_orders = self.run_test(
            "Service Orders Access", 
            "GET",
            "orders",
            200,
            token=self.service_token
        )
        
        # Driver access - can only see their orders
        success_driver, driver_orders = self.run_test(
            "Driver Orders Access",
            "GET",
            "orders", 
            200,
            token=self.driver_token
        )
        
        return success_boss and success_service and success_driver

    def test_settings_access(self):
        """Test settings access (boss only)"""
        # Boss can access settings
        success_boss, _ = self.run_test(
            "Boss Settings Access",
            "GET",
            "settings",
            200,
            token=self.boss_token
        )
        
        # Service cannot modify settings (but can view)
        success_service, _ = self.run_test(
            "Service Settings Access",
            "GET",
            "settings",
            200,
            token=self.service_token
        )
        
        # Driver cannot modify settings (but can view)
        success_driver, _ = self.run_test(
            "Driver Settings Access",
            "GET",
            "settings",
            200,
            token=self.driver_token
        )
        
        # Test settings update (boss only)
        success_update, _ = self.run_test(
            "Boss Settings Update",
            "PUT",
            "settings",
            200,
            data={"payment_method": "per_package", "per_package_rate": 5.0},
            token=self.boss_token
        )
        
        return success_boss and success_service and success_driver and success_update

    def test_audit_logs(self):
        """Test audit logs access (boss only)"""
        success, _ = self.run_test(
            "Boss Audit Logs",
            "GET",
            "audit-logs",
            200,
            token=self.boss_token
        )
        
        # Service and driver should not have access
        success_forbidden, _ = self.run_test(
            "Service Audit Logs (Should Fail)",
            "GET",
            "audit-logs",
            403,
            token=self.service_token
        )
        
        return success and success_forbidden

    def test_create_order_with_bogo(self):
        """Test BOGO functionality in order creation"""
        # First get inventory to find BOGO items
        success, inventory = self.run_test(
            "Get Inventory for BOGO Test",
            "GET",
            "inventory",
            200,
            token=self.service_token
        )
        
        if not success or not inventory:
            return False
            
        # Find a BOGO enabled item
        bogo_item = None
        for item in inventory:
            if item.get('bogo_enabled', False) and item.get('stock', 0) > 0:
                bogo_item = item
                break
                
        if not bogo_item:
            print("   Warning: No BOGO items found in inventory")
            return True  # Not a failure, just no BOGO items to test
            
        # Create order with BOGO item
        order_data = {
            "address": "123 Test Street, Test City",
            "items": [
                {
                    "item_id": bogo_item["id"],
                    "name": bogo_item["name"],
                    "price": bogo_item["price"],
                    "quantity": 2,
                    "is_free_gift": False
                },
                {
                    "item_id": bogo_item["id"], 
                    "name": bogo_item["name"],
                    "price": 0,
                    "quantity": 2,
                    "is_free_gift": True
                }
            ],
            "total": bogo_item["price"] * 2  # Only paid items count toward total
        }
        
        success, response = self.run_test(
            "Create Order with BOGO",
            "POST",
            "orders",
            200,
            data=order_data,
            token=self.service_token
        )
        
        return success

    def test_payment_workflow(self):
        """Test payment submission and approval workflow"""
        # Driver submits payment
        success_submit, payment_response = self.run_test(
            "Driver Submit Payment",
            "POST",
            "payments",
            200,
            data={"amount": 50.0},
            token=self.driver_token
        )
        
        if not success_submit or 'id' not in payment_response:
            return False
            
        payment_id = payment_response['id']
        
        # Boss approves payment
        success_approve, _ = self.run_test(
            "Boss Approve Payment",
            "PUT",
            f"payments/{payment_id}/approve",
            200,
            token=self.boss_token
        )
        
        return success_submit and success_approve

    def test_driver_hours_logging(self):
        """Test driver hours logging (for hourly payment method)"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        success, _ = self.run_test(
            "Driver Log Hours",
            "POST",
            "driver-hours",
            200,
            data={"date": today, "hours": 8.5},
            token=self.driver_token
        )
        
        return success

def main():
    print("🚀 Starting LogiFlow Pro API Testing...")
    print("=" * 60)
    
    tester = LogiFlowAPITester()
    
    # Run all tests in sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Seed Demo Data", tester.test_seed_data),
        ("Boss Login", tester.test_login_boss),
        ("Service Login", tester.test_login_service),
        ("Driver Login", tester.test_login_driver),
        ("Boss Statistics", tester.test_boss_stats),
        ("Driver Statistics", tester.test_driver_stats),
        ("Inventory Access", tester.test_inventory_access),
        ("Orders Access", tester.test_orders_access),
        ("Settings Management", tester.test_settings_access),
        ("Audit Logs", tester.test_audit_logs),
        ("BOGO Order Creation", tester.test_create_order_with_bogo),
        ("Payment Workflow", tester.test_payment_workflow),
        ("Driver Hours Logging", tester.test_driver_hours_logging),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            success = test_func()
            if not success:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed tests:")
        for test in failed_tests:
            print(f"  - {test}")
    else:
        print(f"\n✅ All major test suites passed!")
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "summary": {
                "tests_run": tester.tests_run,
                "tests_passed": tester.tests_passed,
                "success_rate": round((tester.tests_passed / tester.tests_run) * 100, 1) if tester.tests_run > 0 else 0,
                "failed_test_suites": failed_tests
            },
            "detailed_results": tester.test_results,
            "timestamp": datetime.now().isoformat()
        }, f, indent=2)
    
    print(f"\n💾 Detailed results saved to /app/backend_test_results.json")
    
    return 0 if len(failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())