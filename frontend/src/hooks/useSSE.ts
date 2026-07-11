// /frontend/src/hooks/useSSE.ts
// ANFA Real-Time SSE Hook - Native EventSource API
// Consumes Server-Sent Events from the FastAPI backend for live message updates.

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface MessageEventData {
  event_type: string;
  payload: {
    message_id?: string;
    session_id?: string;
    contact_wa_id?: string;
    contact_name?: string;
    body?: string;
    media_type?: string | null;
    direction?: string;
    timestamp?: string;
    status?: string;
    [key: string]: unknown;
  };
  timestamp?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  lastEventAt: Date | null;
  error: string | null;
  reconnectCount: number;
}

interface UseSSEReturn {
  /** Array of received message events */
  messages: MessageEventData[];
  /** Current connection status */
  connection: ConnectionStatus;
  /** Manually close the connection */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Clear all received messages */
  clearMessages: () => void;
}

// =============================================================================
// SSE HOOK
// =============================================================================

/**
 * useSSE - React hook for consuming Server-Sent Events
 * 
 * Opens a persistent EventSource connection to the backend SSE endpoint
 * and maintains a queue of received message events. Automatically handles
 * reconnection with exponential backoff on connection loss.
 * 
 * @param streamUrl - Full URL to the SSE endpoint (e.g., '/api/chats/stream')
 * @returns Object containing messages array, connection status, and controls
 * 
 * @example
 * const { messages, connection, disconnect } = useSSE('/api/chats/stream');
 * 
 * // Render connection status
 * <span className={connection.connected ? 'text-green-400' : 'text-red-400'}>
 *   {connection.connected ? 'Live' : 'Disconnected'}
 * </span>
 * 
 * // Render messages
 * {messages.map((msg, i) => (
 *   <div key={i}>{msg.payload.body}</div>
 * ))}
 */
export function useSSE(streamUrl: string): UseSSEReturn {
  // Message queue state
  const [messages, setMessages] = useState<MessageEventData[]>([]);
  
  // Connection status state
  const [connection, setConnection] = useState<ConnectionStatus>({
    connected: false,
    lastEventAt: null,
    error: null,
    reconnectCount: 0,
  });
  
  // Use refs for mutable state that shouldn't trigger re-renders
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualClose = useRef(false);
  const messageBufferRef = useRef<MessageEventData[]>([]);
  
  /**
   * Flush the message buffer to state (batched for performance)
   */
  const flushBuffer = useCallback(() => {
    if (messageBufferRef.current.length > 0) {
      setMessages(prev => [...prev, ...messageBufferRef.current]);
      messageBufferRef.current = [];
    }
  }, []);
  
  /**
   * Establish EventSource connection with automatic reconnection
   */
  const connect = useCallback(() => {
    // Don't connect if manually closed
    if (isManualClose.current) return;
    
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    try {
      // Create native EventSource connection
      // EventSource API automatically handles HTTP/2 upgrade when available
      const source = new EventSource(streamUrl);
      eventSourceRef.current = source;
      
      // Connection opened
      source.onopen = () => {
        setConnection(prev => ({
          ...prev,
          connected: true,
          error: null,
          lastEventAt: new Date(),
        }));
      };
      
      // Message received - parse JSON payload
      source.onmessage = (event: MessageEvent) => {
        try {
          // Skip non-JSON events (heartbeats use comment format ': heartbeat')
          if (!event.data || event.data.startsWith(':')) {
            return;
          }
          
          const parsed: MessageEventData = JSON.parse(event.data);
          
          // Update connection status on successful parse
          setConnection(prev => ({
            ...prev,
            connected: true,
            lastEventAt: new Date(),
            error: null,
          }));
          
          // Buffer message for batched state update
          messageBufferRef.current.push(parsed);
          
          // Flush immediately for first few messages, then batch
          if (messageBufferRef.current.length >= 5) {
            flushBuffer();
          } else {
            // Small delay to batch rapid successive messages
            setTimeout(flushBuffer, 50);
          }
          
        } catch (err) {
          // Silently skip non-JSON events (keepalive pings)
          if (event.data && !event.data.includes('{')) {
            return;
          }
          console.warn('[SSE] Failed to parse message:', event.data.substring(0, 200));
        }
      };
      
      // Error handling with automatic reconnection
      source.onerror = () => {
        // Mark as disconnected
        setConnection(prev => ({
          ...prev,
          connected: false,
          error: 'Connection lost',
        }));
        
        // Close the failed connection
        source.close();
        eventSourceRef.current = null;
        
        // Don't reconnect if manually closed
        if (isManualClose.current) return;
        
        // Schedule reconnection with exponential backoff
        setConnection(prev => {
          const delay = Math.min(1000 * Math.pow(2, prev.reconnectCount), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
          
          return {
            ...prev,
            reconnectCount: prev.reconnectCount + 1,
          };
        });
      };
      
    } catch (err) {
      setConnection(prev => ({
        ...prev,
        connected: false,
        error: err instanceof Error ? err.message : 'Failed to connect',
      }));
    }
  }, [streamUrl, flushBuffer]);
  
  /**
   * Manually disconnect the EventSource
   */
  const disconnect = useCallback(() => {
    isManualClose.current = true;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setConnection(prev => ({
      ...prev,
      connected: false,
    }));
  }, []);
  
  /**
   * Manually reconnect (resets manual close flag)
   */
  const reconnect = useCallback(() => {
    isManualClose.current = false;
    setConnection(prev => ({
      ...prev,
      reconnectCount: 0,
      error: null,
    }));
    connect();
  }, [connect]);
  
  /**
   * Clear all received messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    messageBufferRef.current = [];
  }, []);
  
  // Initialize connection on mount
  useEffect(() => {
    isManualClose.current = false;
    connect();
    
    // Periodic buffer flush for low-frequency events
    const flushInterval = setInterval(flushBuffer, 250);
    
    return () => {
      clearInterval(flushInterval);
      disconnect();
    };
  }, [connect, disconnect, flushBuffer]);
  
  return {
    messages,
    connection,
    disconnect,
    reconnect,
    clearMessages,
  };
}

export default useSSE;
