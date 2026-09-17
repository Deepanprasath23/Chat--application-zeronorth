import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { token } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presenceMap, setPresenceMap] = useState({});
  const [listeners, setListeners] = useState([]);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!token) return;

    const configuredUrl = import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsBaseUrl = configuredUrl || `${protocol}//${host}/ws`;
    const wsUrl = `${wsBaseUrl}?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        if (type === 'presence_update') {
          const { user_id, is_online, last_seen } = payload;
          setPresenceMap((prev) => ({
            ...prev,
            [user_id]: { is_online, last_seen },
          }));
        }

        // Notify subscribers
        listeners.forEach((listener) => listener(data));
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed', event.code);
      setIsConnected(false);
      socketRef.current = null;
      
      // Auto reconnect after 3 seconds if token exists
      if (token) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      ws.close();
    };
  }, [token, listeners]);

  useEffect(() => {
    if (token) {
      connect();
    } else {
      if (socketRef.current) {
        socketRef.current.close();
      }
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token, connect]);

  const subscribe = useCallback((callback) => {
    setListeners((prev) => [...prev, callback]);
    return () => {
      setListeners((prev) => prev.filter((l) => l !== callback));
    };
  }, []);

  const sendWSMessage = useCallback((conversationId, content) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          conversation_id: conversationId,
          content,
        })
      );
    }
  }, []);

  const sendWSTyping = useCallback((conversationId, isTyping) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'typing',
          conversation_id: conversationId,
          is_typing: isTyping,
        })
      );
    }
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        presenceMap,
        subscribe,
        sendWSMessage,
        sendWSTyping,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
