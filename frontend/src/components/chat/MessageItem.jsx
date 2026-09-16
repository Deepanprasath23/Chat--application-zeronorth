import React from 'react';

const MessageItem = ({ message, isSelf, isGroup }) => {
  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-wrapper ${isSelf ? 'self' : 'other'}`}>
      {!isSelf && isGroup && (
        <div className="sender-name">{message.sender?.username || 'Member'}</div>
      )}
      <div className="message-bubble">
        {message.content}
        <div className="message-meta">{formattedTime}</div>
      </div>
    </div>
  );
};

export default MessageItem;
