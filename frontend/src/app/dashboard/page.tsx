// /frontend/src/app/dashboard/page.tsx
// ANFA Dashboard - Real-Time WhatsApp Chat Management Interface
// Features: Live message stream via SSE, session management, agent controls.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSSE, MessageEventData } from '@/hooks/useSSE';
import { formatDistanceToNow } from 'date-fns';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ChatSession {
  id: string;
  contact_name: string;
  contact_wa_id: string;
  status: 'open' | 'pending' | 'closed';
  last_message: string;
  last_message_at: string;
  unread_count: number;
  assigned_agent?: string;
}

interface ChatMessage {
  id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  sender_type: string;
  status: string;
  created_at: string;
}

// =============================================================================
// MOCK DATA (until API integration)
// =============================================================================

const mockSessions: ChatSession[] = [
  {
    id: '1',
    contact_name: 'John Smith',
    contact_wa_id: '1234567890',
    status: 'open',
    last_message: 'Hi, I have a question about my order',
    last_message_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    unread_count: 3,
    assigned_agent: 'Alice',
  },
  {
    id: '2',
    contact_name: 'Sarah Johnson',
    contact_wa_id: '0987654321',
    status: 'pending',
    last_message: 'Thank you for your help!',
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unread_count: 0,
  },
  {
    id: '3',
    contact_name: 'Michael Chen',
    contact_wa_id: '5551234567',
    status: 'open',
    last_message: 'When will my package arrive?',
    last_message_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    unread_count: 1,
    assigned_agent: 'Bob',
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    body: 'Hello! How can I help you today?',
    direction: 'outbound',
    sender_type: 'agent',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    body: 'Hi, I have a question about my order #12345',
    direction: 'inbound',
    sender_type: 'contact',
    status: 'delivered',
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: '3',
    body: 'Of course! Let me look that up for you.',
    direction: 'outbound',
    sender_type: 'agent',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: '4',
    body: 'Your order is scheduled for delivery tomorrow between 2-4 PM.',
    direction: 'outbound',
    sender_type: 'agent',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: '5',
    body: 'Great, thank you! Will someone call me before delivery?',
    direction: 'inbound',
    sender_type: 'contact',
    status: 'delivered',
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: '6',
    body: 'Yes, the delivery driver will call you 30 minutes before arrival.',
    direction: 'outbound',
    sender_type: 'agent',
    status: 'read',
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '7',
    body: 'Perfect, thanks for your help!',
    direction: 'inbound',
    sender_type: 'contact',
    status: 'delivered',
    created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
];

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    sent: 'bg-blue-500/20 text-blue-400',
    delivered: 'bg-green-500/20 text-green-400',
    read: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

// =============================================================================
// CONNECTION STATUS COMPONENT
// =============================================================================

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`relative flex h-2.5 w-2.5 ${connected ? 'connection-active' : ''}`}>
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      </span>
      <span className={`text-xs font-medium ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function DashboardPage() {
  // SSE connection for real-time messages
  const { messages: sseMessages, connection, disconnect, reconnect } = useSSE('/api/chats/stream');
  
  // Local state
  const [sessions] = useState<ChatSession[]>(mockSessions);
  const [activeSessionId, setActiveSessionId] = useState<string>(mockSessions[0]?.id || '');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(mockMessages);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Combine mock messages with real-time SSE messages
  useEffect(() => {
    if (sseMessages.length > 0) {
      const latestEvent = sseMessages[sseMessages.length - 1];
      if (latestEvent.event_type === 'message_received' && latestEvent.payload) {
        const newMessage: ChatMessage = {
          id: latestEvent.payload.message_id || `sse-${Date.now()}`,
          body: latestEvent.payload.body || '',
          direction: 'inbound',
          sender_type: 'contact',
          status: 'delivered',
          created_at: latestEvent.payload.timestamp || new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, newMessage]);
      }
    }
  }, [sseMessages]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Handle send message
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim()) return;
    
    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      body: inputText.trim(),
      direction: 'outbound',
      sender_type: 'agent',
      status: 'sent',
      created_at: new Date().toISOString(),
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setInputText('');
    setIsTyping(false);
    inputRef.current?.focus();
  }, [inputText]);
  
  // Handle key press (Enter to send)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);
  
  // Active session
  const activeSession = sessions.find(s => s.id === activeSessionId);
  
  // Stats
  const stats = {
    totalSessions: sessions.length,
    openSessions: sessions.filter(s => s.status === 'open').length,
    pendingSessions: sessions.filter(s => s.status === 'pending').length,
    totalUnread: sessions.reduce((sum, s) => sum + s.unread_count, 0),
  };
  
  return (
    <div className="h-screen flex flex-col bg-anfa-dark">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-anfa-border bg-anfa-panel/80 backdrop-blur-md flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="font-semibold text-anfa-text text-sm hidden sm:block">ANFA Dashboard</span>
          </Link>
          
          <div className="h-6 w-px bg-anfa-border mx-2" />
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-anfa-muted">Active:</span>
              <span className="text-green-400 font-medium">{stats.openSessions}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-anfa-muted">Pending:</span>
              <span className="text-yellow-400 font-medium">{stats.pendingSessions}</span>
            </div>
            {stats.totalUnread > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-anfa-muted">Unread:</span>
                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                  {stats.totalUnread}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* SSE Connection Status */}
          <ConnectionIndicator connected={connection.connected} />
          
          {!connection.connected && (
            <button
              onClick={reconnect}
              className="text-xs px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-400 hover:bg-primary-600/30 transition-colors"
            >
              Reconnect
            </button>
          )}
          
          {/* Agent Avatar */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center text-xs font-medium text-white">
              A
            </div>
            <span className="text-sm text-anfa-text hidden sm:block">Agent</span>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Session List */}
        <aside className="w-72 border-r border-anfa-border bg-anfa-panel/30 flex flex-col flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-anfa-border">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-anfa-dark border border-anfa-border text-sm text-anfa-text placeholder-anfa-muted focus:outline-none focus:border-primary-600 transition-colors"
              />
              <svg className="w-4 h-4 text-anfa-muted absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Session List */}
          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-anfa-panel/50 transition-colors border-b border-anfa-border/50 ${
                  activeSessionId === session.id ? 'bg-anfa-panel/80 border-l-2 border-l-primary-500' : 'border-l-2 border-l-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-anfa-border flex items-center justify-center text-sm font-medium text-anfa-muted">
                    {session.contact_name.charAt(0)}
                  </div>
                  {session.status === 'open' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-anfa-panel" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-anfa-text truncate">
                      {session.contact_name}
                    </span>
                    <span className="text-xs text-anfa-muted flex-shrink-0 ml-2">
                      {formatDistanceToNow(new Date(session.last_message_at), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-anfa-muted truncate">
                    {session.last_message}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={session.status} />
                    {session.unread_count > 0 && (
                      <span className="bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                        {session.unread_count}
                      </span>
                    )}
                    {session.assigned_agent && (
                      <span className="text-xs text-anfa-muted">
                        @{session.assigned_agent}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
        
        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {activeSession ? (
            <>
              {/* Chat Header */}
              <div className="h-14 border-b border-anfa-border bg-anfa-panel/30 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-anfa-border flex items-center justify-center text-xs font-medium text-anfa-muted">
                    {activeSession.contact_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-anfa-text">
                      {activeSession.contact_name}
                    </div>
                    <div className="text-xs text-anfa-muted">
                      {activeSession.contact_wa_id}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeSession.status} />
                  <button className="p-2 rounded-lg hover:bg-anfa-panel transition-colors text-anfa-muted">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'} message-animate`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`max-w-[70%] ${message.direction === 'outbound' ? 'message-outbound' : 'message-inbound'} p-3`}>
                      <p className="text-sm text-anfa-text whitespace-pre-wrap">{message.body}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1.5">
                        <span className="text-xs text-anfa-muted">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: false })}
                        </span>
                        {message.direction === 'outbound' && (
                          <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="message-inbound p-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-anfa-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-anfa-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-anfa-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className="border-t border-anfa-border bg-anfa-panel/30 p-4 flex-shrink-0">
                <div className="flex items-end gap-3">
                  <button className="p-2.5 rounded-xl hover:bg-anfa-panel text-anfa-muted transition-colors flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        setIsTyping(e.target.value.length > 0);
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full px-4 py-2.5 rounded-xl bg-anfa-dark border border-anfa-border text-sm text-anfa-text placeholder-anfa-muted focus:outline-none focus:border-primary-600 transition-colors resize-none max-h-32"
                      style={{ minHeight: '40px' }}
                    />
                  </div>
                  
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className="p-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-anfa-panel border border-anfa-border flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-anfa-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-anfa-text mb-2">Select a conversation</h3>
                <p className="text-sm text-anfa-muted max-w-xs">
                  Choose a chat from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </main>
        
        {/* Right Panel - Contact Info */}
        <aside className="w-64 border-l border-anfa-border bg-anfa-panel/30 hidden xl:flex flex-col flex-shrink-0">
          {activeSession ? (
            <>
              <div className="p-4 border-b border-anfa-border text-center">
                <div className="w-16 h-16 rounded-full bg-anfa-border flex items-center justify-center text-xl font-medium text-anfa-muted mx-auto mb-3">
                  {activeSession.contact_name.charAt(0)}
                </div>
                <h3 className="text-sm font-medium text-anfa-text">{activeSession.contact_name}</h3>
                <p className="text-xs text-anfa-muted mt-1">{activeSession.contact_wa_id}</p>
                <StatusBadge status={activeSession.status} />
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-anfa-muted uppercase tracking-wider mb-2">Session Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-anfa-muted">Status</span>
                      <StatusBadge status={activeSession.status} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-anfa-muted">Assigned</span>
                      <span className="text-anfa-text">{activeSession.assigned_agent || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-anfa-muted">Messages</span>
                      <span className="text-anfa-text">{chatMessages.length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-anfa-border pt-4">
                  <h4 className="text-xs font-medium text-anfa-muted uppercase tracking-wider mb-2">Actions</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-anfa-text transition-colors">
                      Assign to Agent
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-anfa-text transition-colors">
                      Mark as Priority
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-anfa-text transition-colors">
                      Add Tag
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-red-400 transition-colors">
                      Close Session
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-anfa-muted">Select a conversation</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
