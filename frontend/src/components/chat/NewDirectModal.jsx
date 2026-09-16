import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import Avatar from '../common/Avatar';
import { X, Search, UserPlus } from 'lucide-react';

const NewDirectModal = ({ isOpen, onClose, onConversationCreated }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users?q=${encodeURIComponent(query)}`);
        setUsers(res.data);
      } catch (err) {
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const handleSelectUser = async (recipientId) => {
    try {
      const res = await api.post('/conversations/direct', { recipient_id: recipientId });
      onConversationCreated(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create conversation');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">New 1-on-1 Message</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <div className="form-group" style={{ position: 'relative' }}>
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search users by username or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '0.8rem', color: 'var(--text-subtle)' }} />
        </div>

        <div className="user-select-list">
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Searching users...</div>
          ) : users.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
          ) : (
            users.map((u) => (
              <div
                key={u.id}
                className="user-select-item"
                onClick={() => handleSelectUser(u.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar name={u.username} isOnline={u.is_online} showStatus={true} size={36} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.username}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                </div>
                <UserPlus size={18} style={{ color: 'var(--accent-color)' }} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewDirectModal;
