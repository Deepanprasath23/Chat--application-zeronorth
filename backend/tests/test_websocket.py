def test_websocket_messaging(client):
    # Register user
    res = client.post("/api/auth/register", json={"email": "ws_user@test.com", "username": "ws_user", "password": "pass"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Register recipient
    res_rec = client.post("/api/auth/register", json={"email": "rec@test.com", "username": "rec", "password": "pass"})
    rec_id = res_rec.json()["user"]["id"]

    # Create direct conversation
    conv_res = client.post("/api/conversations/direct", json={"recipient_id": rec_id}, headers=headers)
    conv_id = conv_res.json()["id"]

    # Test WebSocket connection and message sending
    with client.websocket_connect(f"/ws?token={token}") as websocket:
        # First event on connect might be presence_update
        data1 = websocket.receive_json()
        if data1["type"] == "presence_update":
            # Presence event received as expected
            assert data1["payload"]["is_online"] is True
        
        # Send message
        websocket.send_json({
            "type": "send_message",
            "conversation_id": conv_id,
            "content": "Hello via WebSocket!"
        })

        # Receive new message event
        data2 = websocket.receive_json()
        assert data2["type"] == "new_message"
        assert data2["payload"]["conversation_id"] == conv_id
        assert data2["payload"]["message"]["content"] == "Hello via WebSocket!"
