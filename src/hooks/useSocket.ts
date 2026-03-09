'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

interface TypingUser {
  userId: string;
  name: string;
}

interface MessageData {
  id: string;
  content: string;
  messageType: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  replyTo: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  reactions: Record<string, string[]>;
  conversationId: string;
}

interface MessageEditedData {
  messageId: string;
  content: string;
  conversationId: string;
}

interface MessageDeletedData {
  messageId: string;
  conversationId: string;
}

interface TypingUpdateData {
  conversationId: string;
  typingUsers: TypingUser[];
}

interface MessagesReadData {
  conversationId: string;
  userId: string;
  messageIds: string[];
}

interface ReactionUpdatedData {
  messageId: string;
  conversationId: string;
  reactions: Record<string, string[]>;
  action: 'added' | 'removed';
  emoji: string;
  userName: string;
}

interface UserStatusData {
  userId: string;
  isOnline: boolean;
}

interface NotificationData {
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
}

export type { MessageData, MessageEditedData, MessageDeletedData, MessagesReadData, ReactionUpdatedData, NotificationData, TypingUser };

export function useSocket() {
  const { user, getAccessToken } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const activeConversationRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 10;
  const [token, setToken] = useState<string | null>(null);

  // Track when token becomes available
  useEffect(() => {
    if (!user) {
      setToken(null);
      return;
    }
    const check = () => {
      const t = getAccessToken();
      if (t) {
        setToken(t);
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  }, [user, getAccessToken]);

  // Event handler refs so consumers can register callbacks
  const onNewMessageRef = useRef<((data: MessageData) => void) | null>(null);
  const onMessageEditedRef = useRef<((data: MessageEditedData) => void) | null>(null);
  const onMessageDeletedRef = useRef<((data: MessageDeletedData) => void) | null>(null);
  const onMessagesReadRef = useRef<((data: MessagesReadData) => void) | null>(null);
  const onReactionUpdatedRef = useRef<((data: ReactionUpdatedData) => void) | null>(null);
  const onNewNotificationRef = useRef<((data: NotificationData) => void) | null>(null);

  // Fetch unread counts from API
  const fetchUnreadCounts = useCallback(async () => {
    const currentToken = getAccessToken();
    if (!currentToken) return;
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${currentToken}` };
      const [convRes, notifRes] = await Promise.all([
        fetch('/api/conversations', { headers }),
        fetch('/api/notifications?limit=1', { headers }),
      ]);
      if (convRes.ok) {
        const data = await convRes.json();
        const total = (data.conversations || []).reduce(
          (s: number, c: { unreadCount?: number }) => s + (c.unreadCount || 0),
          0
        );
        setUnreadChatCount(total);
      }
      if (notifRes.ok) {
        const data = await notifRes.json();
        setUnreadNotifCount(data.unreadCount || 0);
      }
    } catch {
      // Silently fail
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!user || !token) return;

    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const socket = io({
      auth: { token },
      transports: isProduction ? ['polling'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: maxReconnectAttempts,
      upgrade: !isProduction,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      reconnectAttemptRef.current = 0;

      // Fetch online friends
      socket.emit('get_online_friends', (response: { onlineFriends: string[] }) => {
        if (response?.onlineFriends) {
          setOnlineUsers(new Set(response.onlineFriends));
        }
      });

      // Fetch unread counts
      fetchUnreadCounts();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      reconnectAttemptRef.current++;
      if (error.message === 'Invalid token') {
        socket.disconnect();
      }
    });

    // User online/offline status
    socket.on('user_status', (data: UserStatusData) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.isOnline) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    // New message
    socket.on('new_message', (data: MessageData) => {
      onNewMessageRef.current?.(data);
      // Update unread chat count if message is from someone else and not in active conversation
      if (data.sender.id !== user.id && data.conversationId !== activeConversationRef.current) {
        setUnreadChatCount((prev) => prev + 1);
      }
    });

    // Message edited
    socket.on('message_edited', (data: MessageEditedData) => {
      onMessageEditedRef.current?.(data);
    });

    // Message deleted
    socket.on('message_deleted', (data: MessageDeletedData) => {
      onMessageDeletedRef.current?.(data);
    });

    // Typing indicators
    socket.on('typing_update', (data: TypingUpdateData) => {
      setTypingUsers((prev) => ({
        ...prev,
        [data.conversationId]: data.typingUsers.filter((t) => t.userId !== user.id),
      }));
    });

    // Read receipts
    socket.on('messages_read', (data: MessagesReadData) => {
      onMessagesReadRef.current?.(data);
    });

    // Reaction updates
    socket.on('reaction_updated', (data: ReactionUpdatedData) => {
      onReactionUpdatedRef.current?.(data);
    });

    // Notifications
    socket.on('new_notification', (data: NotificationData) => {
      onNewNotificationRef.current?.(data);
      setUnreadNotifCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, token, fetchUnreadCounts]);

  // ---- Emitter functions ----

  const sendMessage = useCallback(
    (conversationId: string, content: string, messageType?: string, replyToId?: string, mediaUrl?: string, mediaType?: string, mediaMetadata?: Record<string, unknown>) => {
      socketRef.current?.emit('send_message', { conversationId, content, messageType, replyToId, mediaUrl, mediaType, mediaMetadata });
    },
    []
  );

  const editMessage = useCallback((messageId: string, content: string) => {
    socketRef.current?.emit('edit_message', { messageId, content });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    socketRef.current?.emit('delete_message', { messageId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_start', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing_stop', { conversationId });
  }, []);

  const markMessagesRead = useCallback((conversationId: string, messageIds: string[]) => {
    socketRef.current?.emit('messages_read', { conversationId, messageIds });
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    socketRef.current?.emit('toggle_reaction', { messageId, emoji });
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join_conversation', { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave_conversation', { conversationId });
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    activeConversationRef.current = id;
  }, []);

  // ---- Listener setters ----

  const onNewMessage = useCallback((handler: (data: MessageData) => void) => {
    onNewMessageRef.current = handler;
  }, []);

  const onMessageEdited = useCallback((handler: (data: MessageEditedData) => void) => {
    onMessageEditedRef.current = handler;
  }, []);

  const onMessageDeleted = useCallback((handler: (data: MessageDeletedData) => void) => {
    onMessageDeletedRef.current = handler;
  }, []);

  const onMessagesRead = useCallback((handler: (data: MessagesReadData) => void) => {
    onMessagesReadRef.current = handler;
  }, []);

  const onReactionUpdated = useCallback((handler: (data: ReactionUpdatedData) => void) => {
    onReactionUpdatedRef.current = handler;
  }, []);

  const onNewNotification = useCallback((handler: (data: NotificationData) => void) => {
    onNewNotificationRef.current = handler;
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);

  return {
    isConnected,
    onlineUsers,
    typingUsers,
    unreadChatCount,
    unreadNotifCount,
    setUnreadChatCount,
    setUnreadNotifCount,
    setActiveConversation,
    refreshUnreadCounts: fetchUnreadCounts,
    // Emitters
    sendMessage,
    editMessage,
    deleteMessage,
    startTyping,
    stopTyping,
    markMessagesRead,
    toggleReaction,
    joinConversation,
    leaveConversation,
    // Listener setters
    onNewMessage,
    onMessageEdited,
    onMessageDeleted,
    onMessagesRead,
    onReactionUpdated,
    onNewNotification,
    // Raw socket access (for call manager, etc.)
    getSocket,
  };
}
