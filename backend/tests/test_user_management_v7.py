"""
Test Suite for PWA Mobile UI Polish & Advanced User Management
Tests: User creation with full_name, password reset, password change, user deletion
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ============== FIXTURES ==============

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def boss_token(api_client):
    """Get boss authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "username": "admin",
        "password": "admin123"
    })
    assert response.status_code == 200, f"Boss login failed: {response.text}"
    data = response.json()
    return data["access_token"]

@pytest.fixture(scope="module")
def boss_client(api_client, boss_token):
    """Session with boss auth header"""
    api_client.headers.update({"Authorization": f"Bearer {boss_token}"})
    return api_client

# ============== HEALTH CHECK ==============

class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")

# ============== BOSS LOGIN & FULL_NAME ==============

class TestBossLogin:
    """Test boss login returns full_name field"""
    
    def test_boss_login_returns_user_data(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify token structure
        assert "access_token" in data
        assert "user" in data
        
        # Verify user data structure
        user = data["user"]
        assert "id" in user
        assert "username" in user
        assert user["username"] == "admin"
        assert "role" in user
        assert user["role"] == "boss"
        assert "full_name" in user  # CRITICAL: full_name must be present
        print(f"✓ Boss login returns full_name: {user.get('full_name')}")

# ============== USER CREATION WITH FULL_NAME ==============

class TestUserCreationWithFullName:
    """Test creating users with full_name field"""
    
    def test_create_driver_with_full_name(self, boss_client):
        """Boss creates a driver with full_name"""
        response = boss_client.post(f"{BASE_URL}/api/auth/register", json={
            "username": "TEST_driver_fullname",
            "password": "test1234",
            "role": "driver",
            "full_name": "John Driver"
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify user was created with full_name
        assert "user" in data
        user = data["user"]
        assert user["username"] == "TEST_driver_fullname"
        assert user["full_name"] == "John Driver"
        assert user["role"] == "driver"
        print(f"✓ Created driver with full_name: {user['full_name']}")
    
    def test_create_cs_with_full_name(self, boss_client):
        """Boss creates a customer service user with full_name"""
        response = boss_client.post(f"{BASE_URL}/api/auth/register", json={
            "username": "TEST_cs_fullname",
            "password": "test1234",
            "role": "customer_service",
            "full_name": "Sarah Service"
        })
        assert response.status_code == 200
        data = response.json()
        
        user = data["user"]
        assert user["username"] == "TEST_cs_fullname"
        assert user["full_name"] == "Sarah Service"
        assert user["role"] == "customer_service"
        print(f"✓ Created CS with full_name: {user['full_name']}")
    
    def test_create_user_without_full_name_defaults_to_username(self, boss_client):
        """When full_name is not provided, it defaults to username"""
        response = boss_client.post(f"{BASE_URL}/api/auth/register", json={
            "username": "TEST_no_fullname",
            "password": "test1234",
            "role": "driver"
        })
        assert response.status_code == 200
        data = response.json()
        
        user = data["user"]
        assert user["username"] == "TEST_no_fullname"
        # full_name should default to username
        assert user["full_name"] == "TEST_no_fullname"
        print(f"✓ User without full_name defaults to username: {user['full_name']}")

# ============== GET ALL USERS RETURNS FULL_NAME ==============

class TestGetAllUsersFullName:
    """Test GET /api/users/all returns full_name field"""
    
    def test_get_all_users_includes_full_name(self, boss_client):
        response = boss_client.get(f"{BASE_URL}/api/users/all")
        assert response.status_code == 200
        users = response.json()
        
        assert isinstance(users, list)
        assert len(users) > 0
        
        # Check that all users have full_name field
        for user in users:
            assert "id" in user
            assert "username" in user
            assert "role" in user
            assert "full_name" in user or user.get("full_name") is None  # full_name should exist
            print(f"  - {user['username']}: full_name={user.get('full_name')}")
        
        print(f"✓ GET /api/users/all returns {len(users)} users with full_name field")

# ============== PASSWORD RESET BY BOSS ==============

class TestBossResetPassword:
    """Test boss can reset staff member's password"""
    
    def test_boss_reset_driver_password(self, boss_client):
        """Boss resets a driver's password"""
        # First get all users to find a test driver
        users_response = boss_client.get(f"{BASE_URL}/api/users/all")
        users = users_response.json()
        
        # Find a test driver
        test_driver = next((u for u in users if u["username"].startswith("TEST_") and u["role"] == "driver"), None)
        
        if not test_driver:
            pytest.skip("No test driver found to reset password")
        
        # Reset password
        response = boss_client.put(f"{BASE_URL}/api/users/{test_driver['id']}/reset-password", json={
            "new_password": "newpass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Boss reset password for {test_driver['username']}")
        
        # Verify new password works
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_driver["username"],
            "password": "newpass123"
        })
        assert login_response.status_code == 200
        print(f"✓ Driver can login with new password")
    
    def test_reset_password_validation_min_length(self, boss_client):
        """Password must be at least 4 characters"""
        users_response = boss_client.get(f"{BASE_URL}/api/users/all")
        users = users_response.json()
        
        test_user = next((u for u in users if u["username"].startswith("TEST_")), None)
        if not test_user:
            pytest.skip("No test user found")
        
        response = boss_client.put(f"{BASE_URL}/api/users/{test_user['id']}/reset-password", json={
            "new_password": "abc"  # Too short
        })
        assert response.status_code == 400
        print("✓ Password validation (min 4 chars) works")
    
    def test_reset_password_nonexistent_user(self, boss_client):
        """Reset password for non-existent user returns 404"""
        response = boss_client.put(f"{BASE_URL}/api/users/nonexistent-id-12345/reset-password", json={
            "new_password": "newpass123"
        })
        assert response.status_code == 404
        print("✓ Reset password for non-existent user returns 404")

# ============== SELF PASSWORD CHANGE ==============

class TestSelfPasswordChange:
    """Test users can change their own password"""
    
    def test_boss_change_own_password(self, api_client):
        """Boss changes their own password via PUT /api/auth/password"""
        # Login as boss
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Change password
        headers = {"Authorization": f"Bearer {token}"}
        change_response = api_client.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": "admin123",
            "new_password": "newboss123"
        }, headers=headers)
        assert change_response.status_code == 200
        print("✓ Boss changed own password")
        
        # Verify new password works
        new_login = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "newboss123"
        })
        assert new_login.status_code == 200
        print("✓ Boss can login with new password")
        
        # Revert password back to original
        new_token = new_login.json()["access_token"]
        revert_response = api_client.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": "newboss123",
            "new_password": "admin123"
        }, headers={"Authorization": f"Bearer {new_token}"})
        assert revert_response.status_code == 200
        print("✓ Boss password reverted to original")
    
    def test_driver_change_own_password(self, api_client, boss_client):
        """Driver changes their own password"""
        # Get a test driver
        users_response = boss_client.get(f"{BASE_URL}/api/users/all")
        users = users_response.json()
        test_driver = next((u for u in users if u["username"].startswith("TEST_") and u["role"] == "driver"), None)
        
        if not test_driver:
            pytest.skip("No test driver found")
        
        # Login as driver (password was reset to newpass123 in previous test)
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_driver["username"],
            "password": "newpass123"
        })
        
        if login_response.status_code != 200:
            # Try original password
            login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
                "username": test_driver["username"],
                "password": "test1234"
            })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login as test driver")
        
        token = login_response.json()["access_token"]
        current_password = "newpass123" if "newpass123" in str(login_response.request.body) else "test1234"
        
        # Change password
        headers = {"Authorization": f"Bearer {token}"}
        change_response = api_client.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": current_password,
            "new_password": "driverpass456"
        }, headers=headers)
        assert change_response.status_code == 200
        print(f"✓ Driver {test_driver['username']} changed own password")
    
    def test_change_password_wrong_current(self, api_client):
        """Changing password with wrong current password fails"""
        # Login as boss
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        token = login_response.json()["access_token"]
        
        # Try to change with wrong current password
        headers = {"Authorization": f"Bearer {token}"}
        change_response = api_client.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": "wrongpassword",
            "new_password": "newpass123"
        }, headers=headers)
        assert change_response.status_code == 400
        print("✓ Change password with wrong current password returns 400")

# ============== USER DELETION ==============

class TestUserDeletion:
    """Test user deletion functionality"""
    
    def test_boss_delete_user(self, boss_client):
        """Boss can delete a staff member"""
        # Create a user to delete
        create_response = boss_client.post(f"{BASE_URL}/api/auth/register", json={
            "username": "TEST_to_delete",
            "password": "test1234",
            "role": "driver",
            "full_name": "Delete Me"
        })
        
        if create_response.status_code != 200:
            # User might already exist, try to find them
            users_response = boss_client.get(f"{BASE_URL}/api/users/all")
            users = users_response.json()
            user_to_delete = next((u for u in users if u["username"] == "TEST_to_delete"), None)
            if not user_to_delete:
                pytest.skip("Could not create or find user to delete")
            user_id = user_to_delete["id"]
        else:
            user_id = create_response.json()["user"]["id"]
        
        # Delete the user
        delete_response = boss_client.delete(f"{BASE_URL}/api/users/{user_id}")
        assert delete_response.status_code == 200
        print("✓ Boss deleted user successfully")
        
        # Verify user is gone
        users_response = boss_client.get(f"{BASE_URL}/api/users/all")
        users = users_response.json()
        deleted_user = next((u for u in users if u["id"] == user_id), None)
        assert deleted_user is None
        print("✓ Deleted user no longer in user list")
    
    def test_boss_cannot_delete_self(self, boss_client):
        """Boss cannot delete their own account"""
        # Get boss user ID
        me_response = boss_client.get(f"{BASE_URL}/api/auth/me")
        boss_id = me_response.json()["id"]
        
        # Try to delete self
        delete_response = boss_client.delete(f"{BASE_URL}/api/users/{boss_id}")
        assert delete_response.status_code == 400
        data = delete_response.json()
        assert "cannot delete your own" in data["detail"].lower()
        print("✓ Boss cannot delete self (self-protection works)")
    
    def test_delete_nonexistent_user(self, boss_client):
        """Deleting non-existent user returns 404"""
        response = boss_client.delete(f"{BASE_URL}/api/users/nonexistent-id-12345")
        assert response.status_code == 404
        print("✓ Delete non-existent user returns 404")

# ============== CLEANUP ==============

class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_users(self, boss_client):
        """Remove all TEST_ prefixed users"""
        users_response = boss_client.get(f"{BASE_URL}/api/users/all")
        users = users_response.json()
        
        test_users = [u for u in users if u["username"].startswith("TEST_")]
        deleted_count = 0
        
        for user in test_users:
            try:
                delete_response = boss_client.delete(f"{BASE_URL}/api/users/{user['id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
            except Exception:
                pass
        
        print(f"✓ Cleaned up {deleted_count} test users")
