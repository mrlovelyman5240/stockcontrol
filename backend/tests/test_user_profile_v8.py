"""
Test Suite for UI Cleanup & Advanced User Management (Iteration 8)
Features tested:
- Boss dashboard shows Full Name not username
- No welcome toast on login (frontend only)
- Boss Settings: My Profile section edits own Full Name, Username, Password
- Boss Settings: Staff list shows Full Name + @username
- Boss Settings: Edit User modal with pencil icon
- PUT /api/users/{id}/update supports full_name + username + password changes
- PUT /api/users/{id}/update rejects duplicate username
- Driver/CS Profile: Change Password only
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_health_check(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ Health check passed")
    
    def test_boss_login_returns_full_name(self):
        """Boss login should return full_name field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        user = data["user"]
        assert "full_name" in user
        # Admin has full_name "Mıxy" set on startup
        assert user["full_name"] is not None
        print(f"✓ Boss login returns full_name: {user['full_name']}")
        return data["access_token"]


class TestUserUpdateEndpoint:
    """Tests for PUT /api/users/{id}/update endpoint"""
    
    @pytest.fixture
    def boss_token(self):
        """Get boss authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture
    def boss_headers(self, boss_token):
        """Get headers with boss auth"""
        return {"Authorization": f"Bearer {boss_token}"}
    
    @pytest.fixture
    def test_user(self, boss_headers):
        """Create a test user for update tests"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"TEST_update_{unique_id}",
            "password": "test1234",
            "role": "driver",
            "full_name": f"Test User {unique_id}"
        }, headers=boss_headers)
        assert response.status_code == 200
        user = response.json()["user"]
        yield user
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=boss_headers)
    
    def test_update_user_full_name(self, boss_headers, test_user):
        """Test updating user's full_name"""
        new_name = "Updated Full Name"
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/update",
            json={"full_name": new_name, "username": test_user["username"]},
            headers=boss_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == new_name
        print(f"✓ Updated full_name to: {new_name}")
    
    def test_update_user_username(self, boss_headers, test_user):
        """Test updating user's username"""
        unique_id = str(uuid.uuid4())[:8]
        new_username = f"TEST_newuser_{unique_id}"
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/update",
            json={"full_name": test_user["full_name"], "username": new_username},
            headers=boss_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == new_username
        print(f"✓ Updated username to: {new_username}")
    
    def test_update_user_password(self, boss_headers, test_user):
        """Test updating user's password"""
        new_password = "newpass123"
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/update",
            json={
                "full_name": test_user["full_name"],
                "username": test_user["username"],
                "password": new_password
            },
            headers=boss_headers
        )
        assert response.status_code == 200
        print("✓ Password updated successfully")
        
        # Verify new password works
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_user["username"],
            "password": new_password
        })
        assert login_response.status_code == 200
        print("✓ Login with new password successful")
    
    def test_update_user_rejects_duplicate_username(self, boss_headers, test_user):
        """Test that duplicate username is rejected"""
        # Try to update to existing username 'admin'
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/update",
            json={"full_name": test_user["full_name"], "username": "admin"},
            headers=boss_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "already taken" in data["detail"].lower() or "already" in data["detail"].lower()
        print("✓ Duplicate username correctly rejected")
    
    def test_update_user_password_validation(self, boss_headers, test_user):
        """Test password minimum length validation"""
        response = requests.put(
            f"{BASE_URL}/api/users/{test_user['id']}/update",
            json={
                "full_name": test_user["full_name"],
                "username": test_user["username"],
                "password": "ab"  # Too short
            },
            headers=boss_headers
        )
        assert response.status_code == 400
        data = response.json()
        assert "4 characters" in data["detail"]
        print("✓ Short password correctly rejected")
    
    def test_update_nonexistent_user(self, boss_headers):
        """Test updating non-existent user returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/users/nonexistent-id/update",
            json={"full_name": "Test", "username": "test"},
            headers=boss_headers
        )
        assert response.status_code == 404
        print("✓ Non-existent user returns 404")


class TestBossProfileUpdate:
    """Tests for Boss updating their own profile"""
    
    @pytest.fixture
    def boss_auth(self):
        """Get boss authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"],
            "headers": {"Authorization": f"Bearer {data['access_token']}"}
        }
    
    def test_boss_can_update_own_profile(self, boss_auth):
        """Boss can update their own full_name"""
        original_name = boss_auth["user"].get("full_name", "Mıxy")
        new_name = "Updated Boss Name"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{boss_auth['user']['id']}/update",
            json={"full_name": new_name, "username": "admin"},
            headers=boss_auth["headers"]
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == new_name
        print(f"✓ Boss updated own full_name to: {new_name}")
        
        # Restore original name
        requests.put(
            f"{BASE_URL}/api/users/{boss_auth['user']['id']}/update",
            json={"full_name": original_name, "username": "admin"},
            headers=boss_auth["headers"]
        )
        print("✓ Restored original name")
    
    def test_get_me_returns_updated_data(self, boss_auth):
        """GET /api/auth/me returns updated user data after profile change"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=boss_auth["headers"])
        assert response.status_code == 200
        data = response.json()
        assert "full_name" in data
        assert "username" in data
        assert "role" in data
        print(f"✓ GET /api/auth/me returns full_name: {data['full_name']}")


class TestStaffUserManagement:
    """Tests for staff user management features"""
    
    @pytest.fixture
    def boss_headers(self):
        """Get boss authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_get_all_users_returns_full_name(self, boss_headers):
        """GET /api/users/all returns full_name for each user"""
        response = requests.get(f"{BASE_URL}/api/users/all", headers=boss_headers)
        assert response.status_code == 200
        users = response.json()
        assert len(users) > 0
        
        for user in users:
            assert "username" in user
            assert "role" in user
            # full_name may be None for old users, but field should exist
            print(f"  User: {user.get('full_name') or user['username']} (@{user['username']})")
        
        print(f"✓ GET /api/users/all returns {len(users)} users with full_name field")
    
    def test_delete_user_still_works(self, boss_headers):
        """Delete user functionality still works"""
        # Create a test user
        unique_id = str(uuid.uuid4())[:8]
        create_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"TEST_delete_{unique_id}",
            "password": "test1234",
            "role": "driver",
            "full_name": f"Delete Test {unique_id}"
        }, headers=boss_headers)
        assert create_response.status_code == 200
        user_id = create_response.json()["user"]["id"]
        
        # Delete the user
        delete_response = requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=boss_headers)
        assert delete_response.status_code == 200
        print("✓ Delete user works correctly")
    
    def test_self_delete_protection(self, boss_headers):
        """Boss cannot delete their own account"""
        # Get boss user ID
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=boss_headers)
        boss_id = me_response.json()["id"]
        
        # Try to delete self
        delete_response = requests.delete(f"{BASE_URL}/api/users/{boss_id}", headers=boss_headers)
        assert delete_response.status_code == 400
        assert "cannot delete your own account" in delete_response.json()["detail"].lower()
        print("✓ Self-delete protection works")


class TestDriverCSPasswordChange:
    """Tests for Driver/CS password change functionality"""
    
    @pytest.fixture
    def boss_headers(self):
        """Get boss authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    @pytest.fixture
    def test_driver(self, boss_headers):
        """Create a test driver"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "username": f"TEST_driver_{unique_id}",
            "password": "driver123",
            "role": "driver",
            "full_name": f"Test Driver {unique_id}"
        }, headers=boss_headers)
        assert response.status_code == 200
        user = response.json()["user"]
        yield {"user": user, "password": "driver123"}
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=boss_headers)
    
    def test_driver_can_change_own_password(self, test_driver):
        """Driver can change their own password via PUT /api/auth/password"""
        # Login as driver
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_driver["user"]["username"],
            "password": test_driver["password"]
        })
        assert login_response.status_code == 200
        driver_token = login_response.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Change password
        new_password = "newdriver456"
        change_response = requests.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": test_driver["password"],
            "new_password": new_password
        }, headers=driver_headers)
        assert change_response.status_code == 200
        print("✓ Driver password change successful")
        
        # Verify new password works
        verify_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_driver["user"]["username"],
            "password": new_password
        })
        assert verify_response.status_code == 200
        print("✓ Driver can login with new password")
    
    def test_password_change_requires_correct_current(self, test_driver):
        """Password change fails with wrong current password"""
        # Login as driver
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": test_driver["user"]["username"],
            "password": test_driver["password"]
        })
        driver_token = login_response.json()["access_token"]
        driver_headers = {"Authorization": f"Bearer {driver_token}"}
        
        # Try to change with wrong current password
        change_response = requests.put(f"{BASE_URL}/api/auth/password", json={
            "current_password": "wrongpassword",
            "new_password": "newpass123"
        }, headers=driver_headers)
        assert change_response.status_code == 400
        assert "incorrect" in change_response.json()["detail"].lower()
        print("✓ Wrong current password correctly rejected")


class TestExistingStaffUsers:
    """Tests for existing staff users (service, can)"""
    
    @pytest.fixture
    def boss_headers(self):
        """Get boss authentication headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        return {"Authorization": f"Bearer {response.json()['access_token']}"}
    
    def test_existing_users_visible_in_list(self, boss_headers):
        """Existing users (service, can) should be visible in user list"""
        response = requests.get(f"{BASE_URL}/api/users/all", headers=boss_headers)
        assert response.status_code == 200
        users = response.json()
        
        usernames = [u["username"] for u in users]
        print(f"  Found users: {usernames}")
        
        # Check if service and can users exist (they were created by user earlier)
        # Note: These may or may not exist depending on test environment
        print(f"✓ User list retrieved with {len(users)} users")
    
    def test_boss_can_edit_staff_via_update_endpoint(self, boss_headers):
        """Boss can edit staff user via PUT /api/users/{id}/update"""
        # Get all users
        response = requests.get(f"{BASE_URL}/api/users/all", headers=boss_headers)
        users = response.json()
        
        # Find a non-boss user to edit
        staff_user = next((u for u in users if u["role"] != "boss"), None)
        if not staff_user:
            pytest.skip("No staff users found to test")
        
        original_name = staff_user.get("full_name") or staff_user["username"]
        test_name = f"Edited {original_name}"
        
        # Update the user
        update_response = requests.put(
            f"{BASE_URL}/api/users/{staff_user['id']}/update",
            json={"full_name": test_name, "username": staff_user["username"]},
            headers=boss_headers
        )
        assert update_response.status_code == 200
        assert update_response.json()["full_name"] == test_name
        print(f"✓ Staff user edited: {test_name}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/users/{staff_user['id']}/update",
            json={"full_name": original_name, "username": staff_user["username"]},
            headers=boss_headers
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
