import React from 'react';

const Avatar = ({ name = 'U', isOnline = false, showStatus = false, size = 40 }) => {
  const initial = name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <div
      className="avatar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${size * 0.4}px`,
      }}
    >
      {initial}
      {showStatus && (
        <span
          className={`presence-badge ${isOnline ? 'online' : 'offline'}`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;
