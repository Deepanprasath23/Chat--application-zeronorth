import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import Avatar from '../common/Avatar';
import { X, Search, Users, Check } from 'lucide-react';

const NewGroupModal = ({ isOpen, onClose, onConversationCreated }) => {
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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

  const toggleSelectUser = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Please select at least one member');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await api.post('/conversations/group', {
        name: name.trim(),
        member_ids: selectedIds,
      });
      onConversationCreated(res.data);
      onClose();
      setName('');
      setSelectedIds([]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Create Group Chat</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleCreateGroup}>
          <div className="form-group">
            <label className="form-label">Group Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Project Alpha, Hikes & Coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Add Members ({selectedIds.length} selected)</label>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Search users..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '2.2rem', color: 'var(--text-subtle)' }} />
          </div>

          <div className="user-select-list">
            {loading ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Searching users...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No users found</div>
            ) : (
              users.map((u) => {
                const isSelected = selectedIds.includes(u.id);
                return (
                  <div
                    key={u.id}
                    className={`user-select-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelectUser(u.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Avatar name={u.username} isOnline={u.is_online} showStatus={true} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                    {isSelected && <Check size={18} style={{ color: 'var(--accent-color)' }} />}
                  </div>
                );
              })
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={creating}>
            <Users size={18} />
            {creating ? 'Creating Group...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewGroupModal;
