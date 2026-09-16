import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import Sidebar from '../components/chat/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import NewDirectModal from '../components/chat/NewDirectModal';
import NewGroupModal from '../components/chat/NewGroupModal';
import SettingsModal from '../components/chat/SettingsModal';

const ChatPage = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMobileHidden, setIsMobileHidden] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('chat_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chat_theme', theme);
  }, [theme]);

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
  };

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !activeConversation) {
        setActiveConversation(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    }
  }, [activeConversation]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setIsMobileHidden(true);
  };

  const handleBackToSidebar = () => {
    setIsMobileHidden(false);
  };

  const handleConversationCreated = (newConv) => {
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
    setActiveConversation(newConv);
    setIsMobileHidden(true);
  };

  const handleMessageSent = useCallback((convId, lastMsg) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            last_message: lastMsg,
            updated_at: lastMsg.created_at,
          };
        }
        return c;
      }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    );
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={handleSelectConversation}
        onOpenDirectModal={() => setIsDirectModalOpen(true)}
        onOpenGroupModal={() => setIsGroupModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        isMobileHidden={isMobileHidden && Boolean(activeConversation)}
      />
      <ChatWindow
        conversation={activeConversation}
        onMessageSent={handleMessageSent}
        onBackToSidebar={handleBackToSidebar}
      />

      <NewDirectModal
        isOpen={isDirectModalOpen}
        onClose={() => setIsDirectModalOpen(false)}
        onConversationCreated={handleConversationCreated}
      />
      <NewGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onConversationCreated={handleConversationCreated}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
};

export default ChatPage;
