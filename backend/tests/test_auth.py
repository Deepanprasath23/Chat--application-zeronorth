def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "alice@example.com", "username": "alice", "password": "password123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["username"] == "alice"
    assert data["user"]["description"] == "Available"

def test_register_duplicate_email(client):
    client.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "username": "bob", "password": "password123"}
    )
    response = client.post(
        "/api/auth/register",
        json={"email": "bob@example.com", "username": "bob2", "password": "password123"}
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={"email": "charlie@example.com", "username": "charlie", "password": "password123"}
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "charlie@example.com", "password": "password123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_invalid_password(client):
    client.post(
        "/api/auth/register",
        json={"email": "david@example.com", "username": "david", "password": "password123"}
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "david@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_update_user_description(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "eva@example.com", "username": "eva", "password": "password123"}
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    update_res = client.put(
        "/api/users/profile",
        json={"description": "Building cool chat apps!"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Building cool chat apps!"
