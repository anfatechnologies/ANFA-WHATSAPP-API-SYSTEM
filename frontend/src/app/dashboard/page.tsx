// /frontend/src/app/dashboard/page.tsx
// ANFA Dashboard - Real-Time WhatsApp Chat Management Interface
// Features: Live message stream via SSE, session management, agent controls.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useSSE, MessageEventData } from '@/hooks/useSSE';
import { useSettings } from '@/hooks/use-settings';
import { playNotificationSound } from '@/lib/notification-sound';
import { formatDistanceToNow } from 'date-fns';

const fetcher = (url: string) => fetch(url).then(res => res.json());

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
// NO MORE MOCK DATA (Using Live API)
// =============================================================================

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
    closed: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
    sent: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    delivered: 'bg-green-500/20 text-green-400 border-green-500/50',
    read: 'bg-green-500/20 text-green-400 border-green-500/50',
    failed: 'bg-red-500/20 text-red-400 border-red-500/50',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
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
  const { data: settingsData } = useSettings();
  
  // Fetch live sessions
  const { data: rawSessions } = useSWR('/api/chats/sessions', fetcher, { refreshInterval: 5000 });
  const sessions: ChatSession[] = (rawSessions || []).map((s: any) => ({
    id: s.id,
    contact_name: s.contact?.display_name || 'Unknown Contact',
    contact_wa_id: s.contact?.wa_id || '',
    status: s.status,
    last_message: s.summary || 'No recent message',
    last_message_at: s.last_message_at || s.created_at,
    unread_count: 0,
    assigned_agent: s.assigned_agent?.full_name,
  }));
  
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  
  // Set first session active by default
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Fetch live messages for active session
  const { data: rawMessages } = useSWR(activeSessionId ? `/api/chats/sessions/${activeSessionId}/messages` : null, fetcher);
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  // Sync messages from API
  useEffect(() => {
    if (rawMessages) {
      setChatMessages(rawMessages);
    }
  }, [rawMessages, activeSessionId]);

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

        // notification_sound_enabled setting wired to a real sound - defaults
        // to on (true) if settings haven't loaded yet, matching the backend's
        // default. See frontend/src/lib/notification-sound.ts.
        if (settingsData?.notification_sound_enabled ?? true) {
          playNotificationSound();
        }
      }
    }
  }, [sseMessages, settingsData]);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !activeSessionId) return;
    
    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsTyping(false);
    
    // Optimistic UI update
    const optimisticMessage: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      body: messageText,
      direction: 'outbound',
      sender_type: 'agent',
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, optimisticMessage]);
    
    try {
      await fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: 'default', // Using a default for now
          recipient_wa_id: activeSession.contact_wa_id,
          body: messageText,
          preview_url: false
        })
      });
      // The SSE connection should update the UI with the confirmed message.
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    
    inputRef.current?.focus();
  }, [inputText, activeSessionId, sessions]);
  
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
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-10 flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <span className="font-semibold text-slate-100 text-sm hidden sm:block">ANFA Dashboard</span>
          </Link>
          
          <div className="h-6 w-px bg-anfa-border mx-2" />
          
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Active:</span>
              <span className="text-green-400 font-medium">{stats.openSessions}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Pending:</span>
              <span className="text-yellow-400 font-medium">{stats.pendingSessions}</span>
            </div>
            {stats.totalUnread > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Unread:</span>
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
            <span className="text-sm text-slate-100 hidden sm:block">Agent</span>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Session List */}
        <aside className="w-72 border-r border-slate-800 bg-slate-900/50 backdrop-blur-10 flex flex-col flex-shrink-0">
          {/* Search */}
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-anfa-muted focus:outline-none focus:border-primary-600 transition-colors"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-anfa-panel/50 transition-colors border-b border-slate-800/50 ${
                  activeSessionId === session.id ? 'bg-slate-900/50 backdrop-blur-10 border-l-2 border-l-primary-500' : 'border-l-2 border-l-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-anfa-border flex items-center justify-center text-sm font-medium text-slate-400">
                    {session.contact_name.charAt(0)}
                  </div>
                  {session.status === 'open' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-anfa-panel" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium text-slate-100 truncate">
                      {session.contact_name}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-2" suppressHydrationWarning>
                      {formatDistanceToNow(new Date(session.last_message_at), { addSuffix: false })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
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
                      <span className="text-xs text-slate-400">
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
              <div className="h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-10 flex items-center px-4 justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-anfa-border flex items-center justify-center text-xs font-medium text-slate-400">
                    {activeSession.contact_name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {activeSession.contact_name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {activeSession.contact_wa_id}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <StatusBadge status={activeSession.status} />
                  <button className="p-2 rounded-lg hover:bg-anfa-panel transition-colors text-slate-400">
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
                      <p className="text-sm text-slate-100 whitespace-pre-wrap">{message.body}</p>
                      <div className="flex items-center justify-end gap-1.5 mt-1.5">
                        <span className="text-xs text-slate-400" suppressHydrationWarning>
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
              <div className="border-t border-slate-800 bg-slate-900/50 backdrop-blur-10 p-4 flex-shrink-0">
                <div className="flex items-end gap-3">
                  <button className="p-2.5 rounded-xl hover:bg-anfa-panel text-slate-400 transition-colors flex-shrink-0">
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
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-anfa-muted focus:outline-none focus:border-primary-600 transition-colors resize-none max-h-32"
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
                <div className="w-16 h-16 rounded-2xl bg-anfa-panel border border-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-100 mb-2">Select a conversation</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  Choose a chat from the sidebar to start messaging
                </p>
              </div>
            </div>
          )}
        </main>
        
        {/* Right Panel - Contact Info */}
        <aside className="w-64 border-l border-slate-800 bg-slate-900/50 backdrop-blur-10 hidden xl:flex flex-col flex-shrink-0">
          {activeSession ? (
            <>
              <div className="p-4 border-b border-slate-800 text-center">
                <div className="w-16 h-16 rounded-full bg-anfa-border flex items-center justify-center text-xl font-medium text-slate-400 mx-auto mb-3">
                  {activeSession.contact_name.charAt(0)}
                </div>
                <h3 className="text-sm font-medium text-slate-100">{activeSession.contact_name}</h3>
                <p className="text-xs text-slate-400 mt-1">{activeSession.contact_wa_id}</p>
                <StatusBadge status={activeSession.status} />
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Session Info</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status</span>
                      <StatusBadge status={activeSession.status} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned</span>
                      <span className="text-slate-100">{activeSession.assigned_agent || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Messages</span>
                      <span className="text-slate-100">{chatMessages.length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Actions</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-slate-100 transition-colors">
                      Assign to Agent
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-slate-100 transition-colors">
                      Mark as Priority
                    </button>
                    <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-anfa-panel text-sm text-slate-100 transition-colors">
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
              <p className="text-sm text-slate-400">Select a conversation</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
