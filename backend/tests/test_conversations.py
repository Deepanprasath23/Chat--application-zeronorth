def test_conversations_flow(client):
    # Register Alice
    res1 = client.post("/api/auth/register", json={"email": "alice@test.com", "username": "alice", "password": "pass"})
    token_alice = res1.json()["access_token"]
    headers_alice = {"Authorization": f"Bearer {token_alice}"}

    # Register Bob
    res2 = client.post("/api/auth/register", json={"email": "bob@test.com", "username": "bob", "password": "pass"})
    bob_id = res2.json()["user"]["id"]
    token_bob = res2.json()["access_token"]
    headers_bob = {"Authorization": f"Bearer {token_bob}"}

    # Create 1-on-1 direct conversation
    res_direct = client.post(
        "/api/conversations/direct",
        json={"recipient_id": bob_id},
        headers=headers_alice
    )
    assert res_direct.status_code == 200
    conv_id = res_direct.json()["id"]
    assert res_direct.json()["type"] == "direct"

    # Create Group conversation
    res_group = client.post(
        "/api/conversations/group",
        json={"name": "Engineering Team", "member_ids": [bob_id]},
        headers=headers_alice
    )
    assert res_group.status_code == 201
    assert res_group.json()["name"] == "Engineering Team"

    # List conversations for Alice
    res_list = client.get("/api/conversations", headers=headers_alice)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 2
