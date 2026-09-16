def test_messages_authorization(client):
    # Register Alice & Bob
    res1 = client.post("/api/auth/register", json={"email": "u1@test.com", "username": "u1", "password": "pass"})
    headers_u1 = {"Authorization": f"Bearer {res1.json()['access_token']}"}

    res2 = client.post("/api/auth/register", json={"email": "u2@test.com", "username": "u2", "password": "pass"})
    u2_id = res2.json()["user"]["id"]

    res3 = client.post("/api/auth/register", json={"email": "u3@test.com", "username": "u3", "password": "pass"})
    headers_u3 = {"Authorization": f"Bearer {res3.json()['access_token']}"}

    # u1 creates conversation with u2
    conv_res = client.post("/api/conversations/direct", json={"recipient_id": u2_id}, headers=headers_u1)
    conv_id = conv_res.json()["id"]

    # u1 gets messages -> 200 OK (empty array)
    res_msg_u1 = client.get(f"/api/conversations/{conv_id}/messages", headers=headers_u1)
    assert res_msg_u1.status_code == 200
    assert res_msg_u1.json() == []

    # u3 (non-member) tries to get messages -> 403 Forbidden
    res_msg_u3 = client.get(f"/api/conversations/{conv_id}/messages", headers=headers_u3)
    assert res_msg_u3.status_code == 403
