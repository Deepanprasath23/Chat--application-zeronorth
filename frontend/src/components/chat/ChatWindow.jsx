import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import api from '../../api/client';
import Avatar from '../common/Avatar';
import MessageItem from './MessageItem';
import LoadingSpinner from '../common/LoadingSpinner';
import {
  Send,
  MessageSquare,
  Users,
  Info,
  X,
  Search,
  ArrowLeft
} from 'lucide-react';

const formatDateSeparator = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  }
};

const ChatWindow = ({
  conversation,
  onMessageSent,
  onBackToSidebar,
}) => {
  const { user } = useAuth();
  const { presenceMap, sendWSMessage, sendWSTyping, subscribe } = useWebSocket();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showDetails, setShowDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load message history
  useEffect(() => {
    if (!conversation) return;

    const fetchMessages = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/conversations/${conversation.id}/messages?limit=100`);
        setMessages(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load message history');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    setTypingUsers(new Set());
    setSearchQuery('');
    setSearchActive(false);
  }, [conversation?.id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Real-time WebSocket listener
  useEffect(() => {
    if (!conversation) return;

    const unsubscribe = subscribe((data) => {
      const { type, payload } = data;

      if (type === 'new_message') {
        if (payload.conversation_id === conversation.id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message.id)) return prev;
            return [...prev, payload.message];
          });
          onMessageSent(conversation.id, payload.message);
        }
      } else if (type === 'typing_status') {
        if (payload.conversation_id === conversation.id) {
          const { user_id, is_typing } = payload;
          setTypingUsers((prev) => {
            const next = new Set(prev);
            if (is_typing) {
              next.add(user_id);
            } else {
              next.delete(user_id);
            }
            return next;
          });
        }
      }
    });

    return () => unsubscribe();
  }, [conversation?.id, subscribe, onMessageSent]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (conversation) {
      sendWSTyping(conversation.id, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        sendWSTyping(conversation.id, false);
      }, 2000);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    const content = inputText.trim();
    if (!content || !conversation) return;

    sendWSMessage(conversation.id, content);
    setInputText('');

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    sendWSTyping(conversation.id, false);
  };

  // Group messages by Date
  const groupedMessages = useMemo(() => {
    const filtered = searchQuery
      ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : messages;

    const groups = [];
    let currentDate = null;

    filtered.forEach((msg) => {
      const dateStr = formatDateSeparator(msg.created_at);
      if (dateStr !== currentDate) {
        currentDate = dateStr;
        groups.push({ type: 'date', date: dateStr, id: `date-${dateStr}-${msg.id}` });
      }
      groups.push({ type: 'message', data: msg, id: msg.id });
    });

    return groups;
  }, [messages, searchQuery]);

  if (!conversation) {
    return (
      <div className="chat-window">
        <div className="empty-state">
          <MessageSquare size={64} style={{ color: 'var(--text-subtle)', opacity: 0.5 }} />
          <h3>Your Messages</h3>
          <p>Select a conversation from the sidebar or start a new chat to begin messaging.</p>
        </div>
      </div>
    );
  }

  let title = conversation.name;
  let isOnline = false;
  let statusText = '';
  const isGroup = conversation.type === 'group';

  if (!isGroup) {
    const otherMember = conversation.members.find((m) => m.user_id !== user?.id);
    const otherUser = otherMember?.user || { username: 'Unknown User' };
    title = otherUser.username;

    const realTimePresence = presenceMap[otherUser.id];
    isOnline = realTimePresence !== undefined ? realTimePresence.is_online : otherUser.is_online;
    statusText = isOnline ? 'Online' : 'Offline';
  } else {
    statusText = `${conversation.members.length} members`;
  }

  const typingUserNames = Array.from(typingUsers)
    .map((uid) => conversation.members.find((m) => m.user_id === uid)?.user?.username)
    .filter(Boolean);

  const canSend = Boolean(inputText.trim());

  return (
    <div className="chat-window">
      <div className="chat-main-area">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-title-group">
            <button className="icon-btn mobile-back-btn" onClick={onBackToSidebar} title="Back to chats">
              <ArrowLeft size={20} />
            </button>

            {!isGroup ? (
              <Avatar name={title} isOnline={isOnline} showStatus={true} size={40} />
            ) : (
              <div className="avatar-stack">
                {conversation.members.slice(0, 3).map((m) => (
                  <Avatar key={m.id} name={m.user.username} size={34} />
                ))}
              </div>
            )}

            <div>
              <div className="chat-title">{title}</div>
              <div className="chat-status">
                {!isGroup && <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />}
                {statusText}
              </div>
            </div>
          </div>

          {/* Action Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className={`icon-btn ${searchActive ? 'active' : ''}`}
              onClick={() => setSearchActive((prev) => !prev)}
              title="Search in conversation"
            >
              <Search size={18} />
            </button>
            <button
              className={`icon-btn ${showDetails ? 'active' : ''}`}
              onClick={() => setShowDetails((prev) => !prev)}
              title="Conversation Details"
            >
              <Info size={18} />
            </button>
          </div>
        </div>

        {/* Message Search Bar */}
        {searchActive && (
          <div style={{ padding: '0.5rem 1.5rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={16} style={{ color: 'var(--text-subtle)' }} />
            <input
              type="text"
              className="form-input"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              placeholder="Search in message history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="icon-btn" onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Messages Stream */}
        <div className="messages-container">
          {loading ? (
            <LoadingSpinner text="Loading message history..." />
          ) : error ? (
            <div className="error-alert">{error}</div>
          ) : groupedMessages.length === 0 ? (
            <div className="empty-state" style={{ height: 'auto', margin: 'auto' }}>
              <Info size={32} style={{ color: 'var(--accent-color)' }} />
              <p>{searchQuery ? 'No matching messages found.' : 'No messages yet. Say hello!'}</p>
            </div>
          ) : (
            groupedMessages.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.id} className="date-separator">
                    <span>{item.date}</span>
                  </div>
                );
              }
              return (
                <MessageItem
                  key={item.id}
                  message={item.data}
                  isSelf={item.data.sender_id === user?.id}
                  isGroup={isGroup}
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="message-input-container">
          {typingUserNames.length > 0 && (
            <div className="typing-indicator">
              {typingUserNames.join(', ')} {typingUserNames.length > 1 ? 'are' : 'is'} typing...
            </div>
          )}

          <form className="input-form" onSubmit={handleSend}>
            <input
              type="text"
              className="input-field"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
            />

            <button
              type="submit"
              className={`send-btn ${canSend ? 'active' : ''}`}
              disabled={!canSend}
              title="Send Message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Side Details Drawer */}
      {showDetails && (
        <div className="details-drawer">
          <div className="details-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Details</h3>
            <button className="icon-btn" onClick={() => setShowDetails(false)}>
              <X size={18} />
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <Avatar name={title} size={64} style={{ margin: '0 auto 0.75rem auto' }} />
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: '0.5rem' }}>{title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {isGroup ? 'Group Conversation' : 'Direct 1-on-1 Chat'}
            </div>
          </div>

          <div className="member-list-title">
            Members ({conversation.members.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {conversation.members.map((m) => {
              const memPresence = presenceMap[m.user.id];
              const memOnline = memPresence !== undefined ? memPresence.is_online : m.user.is_online;

              return (
                <div key={m.id} className="member-item">
                  <Avatar name={m.user.username} isOnline={memOnline} showStatus={true} size={36} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{m.user.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.user.description || 'Available'}</div>
                  </div>
                  {m.role === 'admin' && <span className="role-badge">Admin</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
