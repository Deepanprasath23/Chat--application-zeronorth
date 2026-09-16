import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ text = 'Loading...' }) => {
  return (
    <div className="empty-state">
      <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-color)', animation: 'spin 1s linear infinite' }} />
      {text && <p style={{ fontSize: '0.9rem' }}>{text}</p>}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
