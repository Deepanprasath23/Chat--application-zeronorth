import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import Avatar from '../common/Avatar';
import { Users, Plus, Search, Settings, MessageCircle } from 'lucide-react';

const Sidebar = ({
  conversations,
  activeConversation,
  onSelectConversation,
  onOpenDirectModal,
  onOpenGroupModal,
  onOpenSettingsModal,
  isMobileHidden,
}) => {
  const { user } = useAuth();
  const { presenceMap } = useWebSocket();
  const [contactQuery, setContactQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const getConversationDetails = (conv) => {
    if (conv.type === 'direct') {
      const otherMember = conv.members.find((m) => m.user_id !== user?.id);
      const otherUser = otherMember?.user || { username: 'Unknown User' };
      
      const realTimePresence = presenceMap[otherUser.id];
      const isOnline = realTimePresence !== undefined ? realTimePresence.is_online : otherUser.is_online;
      
      return {
        name: otherUser.username,
        isOnline,
        avatarName: otherUser.username,
        isGroup: false,
      };
    } else {
      return {
        name: conv.name || 'Group Chat',
        isOnline: false,
        avatarName: conv.name || 'G',
        isGroup: true,
      };
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const details = getConversationDetails(conv);
    return details.name.toLowerCase().includes(contactQuery.toLowerCase());
  });

  return (
    <div className={`sidebar ${isMobileHidden ? 'mobile-hidden' : ''}`}>
      {/* User Profile Header */}
      <div className="sidebar-header">
        <div className="user-profile-brief">
          <div className="brand-avatar" aria-label="Connection">
            <MessageCircle size={20} strokeWidth={2.5} />
            <span className="presence-badge online" title="Online" />
          </div>
          <div className="user-info">
            <div className="username">Connection</div>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <button
            className={`icon-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen((isOpen) => !isOpen)}
            title="Search contacts"
            aria-label="Search contacts"
          >
            <Search size={20} />
          </button>
          <button className="icon-btn" onClick={onOpenSettingsModal} title="Settings" aria-label="Settings">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div className="contact-search">
          <Search size={15} />
          <input
            type="text"
            autoFocus
            placeholder="Search contacts..."
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
          />
        </div>
      )}

      {/* Action Triggers */}
      <div className="sidebar-controls">
        <button className="btn-secondary" onClick={onOpenDirectModal}>
          <Plus size={16} /> Direct
        </button>
        <button className="btn-secondary" onClick={onOpenGroupModal}>
          <Users size={16} /> Group
        </button>
      </div>

      {/* Conversations List */}
      <div className="conversation-list">
        {filteredConversations.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No conversations found. Click Direct or Group to start chatting!
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const details = getConversationDetails(conv);
            const isActive = activeConversation?.id === conv.id;
            const lastMsg = conv.last_message;
            const timeStr = lastMsg
              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const unreadCount = conv.unread_count || 0;

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConversation(conv)}
              >
                <Avatar
                  name={details.avatarName}
                  isOnline={details.isOnline}
                  showStatus={!details.isGroup}
                  size={42}
                />
                <div className="conv-details">
                  <div className="conv-top-row">
                    <span className="conv-name">{details.name}</span>
                    {timeStr && <span className="conv-time">{timeStr}</span>}
                  </div>
                  <div className="conv-bottom-row">
                    <span className="conv-last-msg">
                      {lastMsg
                        ? `${lastMsg.sender_id === user?.id ? 'You: ' : ''}${lastMsg.content}`
                        : 'No messages yet'}
                    </span>
                    {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
