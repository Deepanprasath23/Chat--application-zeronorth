import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import Avatar from '../common/Avatar';
import { X, Moon, Sun, LogOut, Check, UserCheck } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose, theme, onToggleTheme }) => {
  const { user, setUser, logout } = useAuth();
  const [description, setDescription] = useState(user?.description || 'Available');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedSuccess(false);

    try {
      const res = await api.put('/users/profile', { description });
      setUser(res.data);
      localStorage.setItem('chat_user', JSON.stringify(res.data));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update bio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Settings</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="error-alert">{error}</div>}
        {savedSuccess && (
          <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--online-color)', color: '#86efac', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={16} /> Profile description updated successfully!
          </div>
        )}

        {/* User Info Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <Avatar name={user?.username} isOnline={true} showStatus={true} size={52} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{user?.username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
        </div>

        {/* Form to update Description */}
        <form onSubmit={handleSaveProfile} style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">About / Bio Description</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Building React apps, Available, Busy"
              maxLength={150}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            <UserCheck size={16} />
            {saving ? 'Saving...' : 'Save Profile Bio'}
          </button>
        </form>

        {/* Theme Settings */}
        <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <label className="form-label" style={{ marginBottom: '0.75rem' }}>Appearance Theme</label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className={`btn-secondary ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => onToggleTheme('dark')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderColor: theme === 'dark' ? 'var(--accent-color)' : 'var(--border-color)',
                backgroundColor: theme === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
              }}
            >
              <Moon size={18} /> Dark Theme
            </button>
            <button
              type="button"
              className={`btn-secondary ${theme === 'light' ? 'active' : ''}`}
              onClick={() => onToggleTheme('light')}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderColor: theme === 'light' ? 'var(--accent-color)' : 'var(--border-color)',
                backgroundColor: theme === 'light' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
              }}
            >
              <Sun size={18} /> Light Theme
            </button>
          </div>
        </div>

        {/* Logout Section */}
        <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={logout}
            style={{ backgroundColor: 'var(--danger-color)' }}
          >
            <LogOut size={18} /> Sign Out / Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
