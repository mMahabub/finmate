'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { useSocketContext } from '@/context/SocketContext';
import GifPicker from './GifPicker';
import VoiceRecorder from './VoiceRecorder';
import VoicePlayer from './VoicePlayer';
import ThemePicker from './ThemePicker';
import WallpaperPicker from './WallpaperPicker';
import { getThemeStyles, CHAT_THEMES } from '@/lib/chatThemes';
import { getWallpaperStyles, getWallpaperCSS } from '@/lib/chatWallpapers';
import { useCallContext } from '@/context/CallContext';

// ---------- Types ----------

interface ConversationMember {
  id: string;
  name: string;
  avatar_url: string | null;
  isOnline: boolean;
  role: string;
}

interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  isOnline: boolean;
  memberCount: number;
  members: ConversationMember[];
  chatTheme?: string;
  chatWallpaper?: string;
}

interface MessageSender {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface ReplyTo {
  id: string;
  content: string;
  senderName: string;
}

interface Message {
  id: string;
  content: string;
  messageType: string;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt?: string;
  sender: MessageSender;
  replyTo: ReplyTo | null;
  reactions: Record<string, string[]>;
  mediaUrl?: string;
  mediaType?: string;
  mediaMetadata?: { width?: number; height?: number; duration?: number };
}

interface ChatWindowProps {
  conversation: Conversation;
  onBack: () => void;
  currentUserId: string;
  currentUserName: string;
}

// ---------- Avatar ----------

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f97316','#ef4444'];
function getAvatarColor(name: string) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: size, height: size, background: getAvatarColor(name), fontSize: size * 0.4 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ---------- Constants ----------

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const COMMON_EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','🥰','😘','😎','🤔',
  '😅','😢','😭','🥺','😤','🔥','💯','❤️','👍','👎',
  '👋','🎉','🙏','💪','✨','🌟','💀','🤡','🫡','👀',
  '😏','🥳','😴','🤗','😡','💔','🫶','🤝','✅','❌',
];
const CHAR_LIMIT = 5000;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

// ---------- Date Helpers ----------

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------- ChatWindow ----------

export default function ChatWindow({ conversation, onBack, currentUserId, currentUserName }: ChatWindowProps) {
  const {
    onlineUsers, typingUsers,
    sendMessage, editMessage, deleteMessage,
    startTyping, stopTyping,
    markMessagesRead, toggleReaction,
    joinConversation, leaveConversation,
    onNewMessage, onMessageEdited, onMessageDeleted,
    onReactionUpdated, onMessagesRead,
  } = useSocketContext();

  const { makeCall: initiateCall } = useCallContext();

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [chatTheme, setChatTheme] = useState(conversation.chatTheme || 'default');
  const [chatWallpaper, setChatWallpaper] = useState(conversation.chatWallpaper || 'none');
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNearBottomRef = useRef(true);

  // ---------- Theme ----------

  const themeStyles = useMemo(() => getThemeStyles(chatTheme), [chatTheme]);
  const currentThemeDef = CHAT_THEMES[chatTheme as keyof typeof CHAT_THEMES] || CHAT_THEMES.default;

  const wallpaperStyles = useMemo(() => getWallpaperStyles(chatWallpaper), [chatWallpaper]);
  const wallpaperCSS = useMemo(() => getWallpaperCSS(chatWallpaper), [chatWallpaper]);
  const isCustomWallpaper = chatWallpaper.startsWith('custom:');

  // Sync theme/wallpaper when conversation changes
  useEffect(() => {
    setChatTheme(conversation.chatTheme || 'default');
    setChatWallpaper(conversation.chatWallpaper || 'none');
  }, [conversation.id, conversation.chatTheme, conversation.chatWallpaper]);

  // ---------- Fetch Messages ----------

  const fetchMessages = useCallback(async (before?: string) => {
    const isOlder = !!before;
    if (isOlder) setLoadingOlder(true); else setLoadingMessages(true);

    try {
      const params = new URLSearchParams({ limit: '50' });
      if (before) params.set('before', before);
      const data = await apiFetch<{ messages: Message[]; hasMore: boolean }>(
        `/api/conversations/${conversation.id}/messages?${params}`
      );
      if (isOlder) {
        setMessages(prev => [...data.messages, ...prev]);
      } else {
        setMessages(data.messages);
      }
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (isOlder) setLoadingOlder(false); else setLoadingMessages(false);
    }
  }, [conversation.id]);

  // Load messages and join conversation
  useEffect(() => {
    setMessages([]);
    setLoadingMessages(true);
    setReplyToMessage(null);
    setEditingMessage(null);
    setShowEmojiPicker(false);
    setActiveReactionPicker(null);
    setNewMessageCount(0);
    fetchMessages();
    joinConversation(conversation.id);

    return () => {
      leaveConversation(conversation.id);
    };
  }, [conversation.id, fetchMessages, joinConversation, leaveConversation]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0) {
      const unreadIds = messages
        .filter(m => m.sender.id !== currentUserId)
        .map(m => m.id);
      if (unreadIds.length > 0) {
        markMessagesRead(conversation.id, unreadIds);
      }
    }
  }, [messages, conversation.id, currentUserId, markMessagesRead]);

  // ---------- Socket Handlers ----------

  useEffect(() => {
    onNewMessage((message: Message & { conversationId: string }) => {
      if (message.conversationId !== conversation.id) return;
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (isNearBottomRef.current) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      } else {
        setNewMessageCount(prev => prev + 1);
      }
      if (message.sender.id !== currentUserId) {
        markMessagesRead(conversation.id, [message.id]);
      }
    });

    onMessageEdited((data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, content: data.content, isEdited: true } : m
      ));
    });

    onMessageDeleted((data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m
      ));
    });

    onReactionUpdated((data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    });

    onMessagesRead(() => {
      // Read receipts update
    });
  }, [conversation.id, currentUserId, onNewMessage, onMessageEdited, onMessageDeleted, onReactionUpdated, onMessagesRead, markMessagesRead]);

  // ---------- Scroll Logic ----------

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMessages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distFromBottom < 100;
    setShowJumpButton(distFromBottom > 200);

    if (isNearBottomRef.current) {
      setNewMessageCount(0);
    }

    // Infinite scroll - load older messages at top
    if (scrollTop < 60 && hasMore && !loadingOlder) {
      const oldestMessage = messages[0];
      if (oldestMessage) {
        const prevHeight = scrollHeight;
        fetchMessages(oldestMessage.createdAt).then(() => {
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevHeight;
            }
          });
        });
      }
    }
  }, [hasMore, loadingOlder, messages, fetchMessages]);

  const jumpToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
  };

  // ---------- Typing ----------

  const handleInputChange = (value: string) => {
    if (value.length > CHAR_LIMIT) return;
    setInputValue(value);

    startTyping(conversation.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(conversation.id);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ---------- Send / Edit / Delete ----------

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content) return;
    sendMessage(conversation.id, content, 'text', replyToMessage?.id);
    setInputValue('');
    setReplyToMessage(null);
    setShowEmojiPicker(false);
    stopTyping(conversation.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setEditContent(msg.content);
    setActiveReactionPicker(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editContent.trim()) return;
    if (editContent.trim() !== editingMessage.content) {
      editMessage(editingMessage.id, editContent.trim());
    }
    setEditingMessage(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };

  const handleDelete = (msg: Message) => {
    if (window.confirm('Delete this message?')) {
      deleteMessage(msg.id);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    toggleReaction(messageId, emoji);
    setActiveReactionPicker(null);
  };

  const handleReply = (msg: Message) => {
    setReplyToMessage(msg);
    textareaRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setInputValue(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  // ---------- Auto-resize textarea ----------

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);

  // ---------- Typing indicator data ----------

  const currentTyping = typingUsers[conversation.id] || [];
  const filteredTyping = currentTyping.filter(t => t.userId !== currentUserId);

  // ---------- Group messages by date ----------

  const groupedMessages = useMemo(() => {
    const groups: { label: string; messages: Message[] }[] = [];
    let currentLabel = '';
    messages.forEach(msg => {
      const label = getDateLabel(msg.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [messages]);

  // ---------- Header info ----------

  const otherMember = conversation.type === 'direct'
    ? conversation.members.find(m => m.id !== currentUserId)
    : null;
  const isOnline = otherMember ? onlineUsers.has(otherMember.id) : false;

  let statusText: React.ReactNode;
  if (filteredTyping.length > 0) {
    const names = filteredTyping.map(t => t.name);
    const text = names.length === 1 ? `${names[0]} is typing` : `${names.join(', ')} are typing`;
    statusText = (
      <span style={{ color: 'var(--accent-primary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        {text}
        <span style={{ display: 'inline-flex', gap: 2 }}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
      </span>
    );
  } else if (conversation.type === 'direct') {
    if (isOnline) {
      statusText = (
        <span style={{ color: '#22c55e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Online
        </span>
      );
    } else if (otherMember) {
      statusText = (
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Offline
        </span>
      );
    }
  } else {
    statusText = (
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{conversation.memberCount} members</span>
    );
  }

  // ---------- Render ----------

  return (
    <div className="glass-card flex flex-col" style={{ flex: 1, borderRadius: 16, overflow: 'hidden', minHeight: 0, ...themeStyles, transition: 'all 0.3s ease' } as React.CSSProperties}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--card-border)', flexShrink: 0,
      }}>
        {/* Mobile back button */}
        <button
          className="btn-ghost md:hidden"
          onClick={onBack}
          aria-label="Go back"
          style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {conversation.type === 'group' ? (
          <div className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.15)' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        ) : (
          <Avatar name={conversation.name} size={40} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversation.name}
          </p>
          {statusText}
        </div>

        {/* Call buttons (direct chats only) */}
        {conversation.type === 'direct' && otherMember && (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className="btn-ghost"
              aria-label="Audio Call"
              title="Audio Call"
              disabled={!isOnline}
              onClick={() => {
                if (otherMember && isOnline) {
                  initiateCall(otherMember.id, 'audio', conversation.id, {
                    id: otherMember.id,
                    name: otherMember.name,
                    avatar_url: otherMember.avatar_url,
                  });
                }
              }}
              style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
                opacity: isOnline ? 1 : 0.4, cursor: isOnline ? 'pointer' : 'default',
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
            <button
              className="btn-ghost"
              aria-label="Video Call"
              title="Video Call"
              disabled={!isOnline}
              onClick={() => {
                if (otherMember && isOnline) {
                  initiateCall(otherMember.id, 'video', conversation.id, {
                    id: otherMember.id,
                    name: otherMember.name,
                    avatar_url: otherMember.avatar_url,
                  });
                }
              }}
              style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
                opacity: isOnline ? 1 : 0.4, cursor: isOnline ? 'pointer' : 'default',
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </button>
          </div>
        )}

        {/* Menu button */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn-ghost"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Chat options"
            style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="glass-card"
                  style={{
                    position: 'absolute', top: 42, right: 0, zIndex: 51,
                    borderRadius: 12, padding: 4, minWidth: 160,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                  }}
                >
                  <button
                    onClick={() => { setShowThemePicker(true); setShowMenu(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 12px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-primary)', fontSize: 13,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${currentThemeDef.accent}14`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r="2.5" />
                      <circle cx="17.5" cy="10.5" r="2.5" />
                      <circle cx="8.5" cy="7.5" r="2.5" />
                      <circle cx="6.5" cy="12.5" r="2.5" />
                      <path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-1.5 4-3 4h-1.7c-.8 0-1.3.9-.8 1.6.5.6.8 1.3.8 2.1 0 1.6-1.3 2.3-2.3 2.3z" />
                    </svg>
                    Chat Theme
                  </button>
                  <button
                    onClick={() => { setShowWallpaperPicker(true); setShowMenu(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 12px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-primary)', fontSize: 13,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${currentThemeDef.accent}14`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Chat Wallpaper
                  </button>
                  <button
                    onClick={() => setShowMenu(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 12px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-primary)', fontSize: 13,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                    </svg>
                    Mute
                  </button>
                  {conversation.type === 'group' && (
                    <button
                      onClick={() => setShowMenu(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '10px 12px', borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer',
                        color: 'var(--accent-coral)', fontSize: 13,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Leave Group
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column',
          gap: 4, minHeight: 0, position: 'relative',
          ...(chatWallpaper !== 'none' ? wallpaperStyles : { background: themeStyles['--chat-bg'] || 'transparent' }),
          transition: 'background 0.5s ease',
        }}
      >
        {/* Custom wallpaper readability overlay */}
        {isCustomWallpaper && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'var(--background)', opacity: 0.85, zIndex: 0,
          }} />
        )}
        {loadingOlder && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid var(--card-border)',
              borderTopColor: 'var(--accent-primary)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        )}

        {loadingMessages ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: i % 3 === 0 ? 'flex-end' : 'flex-start' }}>
                <div className="skeleton" style={{ width: 140 + (i % 3) * 60, height: 44, borderRadius: 16 }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <motion.div
              animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
              transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
              style={{ fontSize: 48 }}
            >
              👋
            </motion.div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, fontWeight: 500 }}>Say hello!</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Send a message to start the conversation</p>
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.label}>
              {/* Date separator */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 12px',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>
                  {group.label}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
              </div>

              {group.messages.map((msg, idx) => {
                if (msg.messageType === 'system') {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ textAlign: 'center', padding: '8px 16px' }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                        {msg.content}
                      </span>
                    </motion.div>
                  );
                }

                const isMine = msg.sender.id === currentUserId;
                const canEdit = isMine && !msg.isDeleted && (Date.now() - new Date(msg.createdAt).getTime()) < EDIT_WINDOW_MS;
                const canDelete = isMine && !msg.isDeleted;
                const isEditing = editingMessage?.id === msg.id;
                const showActions = hoveredMessageId === msg.id && !isEditing;
                const showSenderName = conversation.type === 'group' && !isMine;

                // Check if previous message is from same sender (for avatar grouping)
                const prevMsg = idx > 0 ? group.messages[idx - 1] : null;
                const showAvatar = !isMine && (!prevMsg || prevMsg.sender.id !== msg.sender.id || prevMsg.messageType === 'system');

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-end', gap: 8, marginTop: showAvatar ? 8 : 2,
                      position: 'relative',
                    }}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => { setHoveredMessageId(null); if (activeReactionPicker === msg.id) setActiveReactionPicker(null); }}
                  >
                    {/* Sender avatar (received messages) */}
                    {!isMine && (
                      <div style={{ width: 32, flexShrink: 0 }}>
                        {showAvatar && <Avatar name={msg.sender.name} size={32} />}
                      </div>
                    )}

                    <div style={{ maxWidth: '70%', position: 'relative' }}>
                      {/* Sender name for groups */}
                      {showSenderName && showAvatar && (
                        <p style={{ color: getAvatarColor(msg.sender.name), fontSize: 12, fontWeight: 600, margin: '0 0 2px 12px' }}>
                          {msg.sender.name}
                        </p>
                      )}

                      {/* Reply preview */}
                      {msg.replyTo && !msg.isDeleted && (
                        <div style={{
                          background: isMine ? 'rgba(255,255,255,0.15)' : `${currentThemeDef.accent}14`,
                          borderLeft: `3px solid ${currentThemeDef.accent}`,
                          borderRadius: '4px 8px 8px 4px',
                          padding: '6px 10px', marginBottom: 4,
                          marginLeft: isMine ? 0 : 0,
                        }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: isMine ? 'rgba(255,255,255,0.9)' : currentThemeDef.accent, margin: 0 }}>
                            {msg.replyTo.senderName}
                          </p>
                          <p style={{ fontSize: 12, color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.replyTo.content.length > 60 ? msg.replyTo.content.slice(0, 60) + '...' : msg.replyTo.content}
                          </p>
                        </div>
                      )}

                      {/* Message bubble */}
                      <div style={{
                        padding: '10px 14px',
                        borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: msg.isDeleted
                          ? 'transparent'
                          : isMine
                            ? currentThemeDef.sentBubble
                            : 'var(--card-bg)',
                        border: msg.isDeleted ? '1px dashed var(--card-border)' : isMine ? 'none' : '1px solid var(--card-border)',
                        color: msg.isDeleted ? 'var(--text-muted)' : isMine ? 'white' : 'var(--text-primary)',
                        position: 'relative',
                        boxShadow: isMine && !msg.isDeleted ? (currentThemeDef.styles['--chat-bubble-shadow'] || 'none') : 'none',
                        transition: 'background 0.3s ease, box-shadow 0.3s ease',
                      }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <textarea
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="glass-input"
                              style={{
                                width: '100%', minHeight: 40, padding: '8px 10px',
                                borderRadius: 8, fontSize: 14, resize: 'none',
                                color: 'var(--text-primary)', background: 'var(--input-bg)',
                              }}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                onClick={handleCancelEdit}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, border: '1px solid var(--card-border)',
                                  background: 'transparent', color: 'var(--text-secondary)',
                                  fontSize: 12, cursor: 'pointer',
                                }}
                              >Cancel</button>
                              <button
                                onClick={handleSaveEdit}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, border: 'none',
                                  background: 'var(--accent-primary)', color: 'white',
                                  fontSize: 12, cursor: 'pointer', fontWeight: 600,
                                }}
                              >Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* GIF message */}
                            {msg.mediaType === 'gif' && msg.mediaUrl ? (
                              <div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.mediaUrl}
                                  alt={msg.content || 'GIF'}
                                  style={{ maxWidth: 250, borderRadius: 8, display: 'block' }}
                                  loading="lazy"
                                />
                              </div>
                            ) : msg.mediaType === 'voice' && msg.mediaUrl ? (
                              /* Voice message */
                              <VoicePlayer
                                url={msg.mediaUrl}
                                duration={msg.mediaMetadata?.duration || 0}
                                isSent={isMine}
                              />
                            ) : (
                              /* Text message */
                              <p style={{
                                margin: 0, fontSize: 14, lineHeight: 1.5,
                                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                fontStyle: msg.isDeleted ? 'italic' : 'normal',
                              }}>
                                {msg.content}
                              </p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                              {msg.isEdited && !msg.isDeleted && (
                                <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>(edited)</span>
                              )}
                              <span style={{ fontSize: 10, opacity: 0.6 }}>{formatTime(msg.createdAt)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Reactions */}
                      {!msg.isDeleted && Object.keys(msg.reactions).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingLeft: 4 }}>
                          {Object.entries(msg.reactions).map(([emoji, users]) => {
                            const hasReacted = users.includes(currentUserName);
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4,
                                  padding: '2px 8px', borderRadius: 12, fontSize: 13,
                                  border: hasReacted ? `1px solid ${currentThemeDef.accent}` : '1px solid var(--card-border)',
                                  background: hasReacted ? `${currentThemeDef.accent}1f` : 'var(--card-bg)',
                                  cursor: 'pointer', lineHeight: 1.6,
                                }}
                              >
                                <span>{emoji}</span>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{users.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Action buttons (hover) */}
                      <AnimatePresence>
                        {showActions && !msg.isDeleted && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            style={{
                              position: 'absolute', top: -8,
                              ...(isMine ? { left: -8 } : { right: -8 }),
                              display: 'flex', gap: 2, zIndex: 10,
                              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                              borderRadius: 10, padding: 2,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                          >
                            <ActionButton
                              title="Reply"
                              onClick={() => handleReply(msg)}
                              icon={
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                </svg>
                              }
                            />
                            <ActionButton
                              title="React"
                              onClick={() => setActiveReactionPicker(activeReactionPicker === msg.id ? null : msg.id)}
                              icon={
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
                                </svg>
                              }
                            />
                            <ActionButton
                              title="Copy"
                              onClick={() => handleCopy(msg.content)}
                              icon={
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                              }
                            />
                            {canEdit && (
                              <ActionButton
                                title="Edit"
                                onClick={() => handleStartEdit(msg)}
                                icon={
                                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                }
                              />
                            )}
                            {canDelete && (
                              <ActionButton
                                title="Delete"
                                onClick={() => handleDelete(msg)}
                                color="var(--accent-coral)"
                                icon={
                                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  </svg>
                                }
                              />
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Reaction picker */}
                      <AnimatePresence>
                        {activeReactionPicker === msg.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 4 }}
                            className="glass-card"
                            style={{
                              position: 'absolute', top: -44,
                              ...(isMine ? { right: 0 } : { left: 0 }),
                              display: 'flex', gap: 2, padding: '6px 8px',
                              borderRadius: 24, zIndex: 20,
                              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                            }}
                          >
                            {REACTION_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                style={{
                                  width: 32, height: 32, borderRadius: '50%', border: 'none',
                                  background: 'transparent', cursor: 'pointer', fontSize: 18,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'transform 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
                                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                              >{emoji}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}

        {/* Typing indicator in messages area */}
        <AnimatePresence>
          {filteredTyping.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
            >
              <div style={{ width: 32 }} />
              <div style={{
                padding: '10px 16px', borderRadius: '16px 16px 16px 4px',
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Jump to bottom button */}
      <AnimatePresence>
        {showJumpButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={jumpToBottom}
            aria-label="Jump to latest messages"
            style={{
              position: 'absolute', bottom: 100, right: 24,
              width: 40, height: 40, borderRadius: '50%',
              background: currentThemeDef.accent, border: 'none',
              color: 'white', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${currentThemeDef.accent}66`,
              zIndex: 10,
            }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {newMessageCount > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--accent-coral)', color: 'white',
                fontSize: 10, fontWeight: 700, borderRadius: 10,
                minWidth: 18, height: 18, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>{newMessageCount}</span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Reply preview bar */}
      <AnimatePresence>
        {replyToMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: '8px 16px', borderTop: '1px solid var(--card-border)',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--card-bg)', flexShrink: 0,
            }}
          >
            <div style={{ width: 3, height: 32, borderRadius: 2, background: currentThemeDef.accent, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: currentThemeDef.accent, margin: 0 }}>
                Replying to {replyToMessage.sender.name}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyToMessage.content.length > 80 ? replyToMessage.content.slice(0, 80) + '...' : replyToMessage.content}
              </p>
            </div>
            <button
              onClick={() => setReplyToMessage(null)}
              aria-label="Cancel reply"
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--card-border)',
        display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0,
        position: 'relative',
      }}>
        {/* Emoji picker button */}
        <button
          onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
          className="btn-ghost"
          aria-label="Open emoji picker"
          style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 0,
            flexShrink: 0,
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={showEmojiPicker ? 'var(--accent-primary)' : 'var(--text-secondary)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>

        {/* GIF picker button */}
        <button
          onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
          className="btn-ghost"
          aria-label="Open GIF picker"
          style={{
            width: 36, height: 36, borderRadius: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 0,
            flexShrink: 0,
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={showGifPicker ? 'var(--accent-primary)' : 'var(--text-secondary)'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <text x="12" y="15" textAnchor="middle" fill={showGifPicker ? 'var(--accent-primary)' : 'var(--text-secondary)'} stroke="none" fontSize="8" fontWeight="bold">GIF</text>
          </svg>
        </button>

        {/* Emoji picker popup */}
        <AnimatePresence>
          {showEmojiPicker && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowEmojiPicker(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                className="glass-card"
                style={{
                  position: 'absolute', bottom: 56, left: 16,
                  borderRadius: 16, padding: 12, zIndex: 41,
                  width: 280, boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2 }}>
                  {COMMON_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { insertEmoji(emoji); setShowEmojiPicker(false); }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none',
                        background: 'transparent', cursor: 'pointer', fontSize: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{emoji}</button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* GIF picker popup */}
        <GifPicker
          isOpen={showGifPicker}
          onClose={() => setShowGifPicker(false)}
          onSelect={(gif) => {
            sendMessage(conversation.id, gif.title || 'GIF', 'gif', replyToMessage?.id, gif.url, 'gif', { width: gif.width, height: gif.height });
            setReplyToMessage(null);
            setShowGifPicker(false);
          }}
        />

        {/* Textarea */}
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            className="glass-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 12,
              fontSize: 14, resize: 'none', lineHeight: 1.5,
              maxHeight: 120, minHeight: 40,
            }}
          />
          {inputValue.length > CHAR_LIMIT - 200 && (
            <span style={{
              position: 'absolute', bottom: -18, right: 4,
              fontSize: 10, color: inputValue.length >= CHAR_LIMIT ? 'var(--accent-coral)' : 'var(--text-muted)',
            }}>
              {inputValue.length}/{CHAR_LIMIT}
            </span>
          )}
        </div>

        {/* Voice recorder */}
        <VoiceRecorder
          onSend={(audioUrl, duration) => {
            sendMessage(conversation.id, 'Voice message', 'voice', replyToMessage?.id, audioUrl, 'voice', { duration });
            setReplyToMessage(null);
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          aria-label="Send message"
          style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: inputValue.trim()
              ? currentThemeDef.sentBubble
              : 'var(--input-border)',
            color: 'white', cursor: inputValue.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.2s',
            opacity: inputValue.trim() ? 1 : 0.5,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Theme Picker */}
      <ThemePicker
        isOpen={showThemePicker}
        onClose={() => setShowThemePicker(false)}
        conversationId={conversation.id}
        currentTheme={chatTheme}
        onThemeChange={(theme) => setChatTheme(theme)}
      />

      {/* Wallpaper Picker */}
      <WallpaperPicker
        isOpen={showWallpaperPicker}
        onClose={() => setShowWallpaperPicker(false)}
        conversationId={conversation.id}
        currentWallpaper={chatWallpaper}
        onWallpaperChange={(wp) => setChatWallpaper(wp)}
      />

      {/* Spin animation keyframe + wallpaper CSS */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        ${wallpaperCSS}
      `}</style>
    </div>
  );
}

// ---------- Action Button ----------

function ActionButton({ title, onClick, icon, color }: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none',
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: color || 'var(--text-secondary)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
    </button>
  );
}
