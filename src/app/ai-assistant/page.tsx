'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { getCurrencySymbol } from '@/lib/formatCurrency';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

const DEFAULT_SUGGESTIONS = [
  'How much did I spend this month?',
  'Am I within budget?',
  'Compare this month to last month',
  'Where can I save money?',
  "What's my spending trend?",
  'Category breakdown',
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [isFallback, setIsFallback] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function buildHistory(): ConversationMessage[] {
    return messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await apiFetch<{
        response: string;
        suggestions: string[];
        fallback?: boolean;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: buildHistory(),
          currencySymbol: getCurrencySymbol(),
        }),
      });

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (data.suggestions?.length) setSuggestions(data.suggestions);
      if (data.fallback) setIsFallback(true);
    } catch (err) {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: err instanceof Error && err.message.includes('Rate limit')
          ? 'I need a short break! Please wait a moment and try again.'
          : 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setIsFallback(false);
    inputRef.current?.focus();
  }

  async function handleCopy(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
            }}
          >
            <SparkleIcon />
          </div>
          <div>
            <h1 className="text-lg font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
              FinMate AI
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isFallback ? 'Smart insights from your data' : 'Your financial assistant'}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleNewChat}
            className="btn-ghost text-sm inline-flex items-center gap-1.5"
          >
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </motion.button>
        )}
      </motion.div>

      {isFallback && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-3 mb-4 text-xs flex items-center gap-2"
          style={{ borderLeft: '3px solid #f59e0b', color: 'var(--text-secondary)' }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#f59e0b">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          Running without AI — showing insights from your data. Add a Gemini API key in Settings for full AI chat.
        </motion.div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full text-center px-4"
          >
            <div
              className="rounded-2xl flex items-center justify-center mb-6"
              style={{
                width: 80,
                height: 80,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                boxShadow: '0 12px 40px rgba(99, 102, 241, 0.3)',
              }}
            >
              <SparkleIcon size={40} />
            </div>
            <h2 className="text-xl font-heading font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Ask FinMate AI
            </h2>
            <p className="text-sm mb-8 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Get insights about your spending, budgets, trends, and personalized saving tips based on your real data.
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {suggestions.map((s) => (
                <motion.button
                  key={s}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => sendMessage(s)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2.5 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    {/* Avatar */}
                    {msg.role === 'assistant' ? (
                      <div
                        className="flex-shrink-0 rounded-lg flex items-center justify-center"
                        style={{
                          width: 32,
                          height: 32,
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                          marginTop: 2,
                        }}
                      >
                        <SparkleIcon size={16} />
                      </div>
                    ) : null}

                    {/* Bubble */}
                    <div className="group relative">
                      <div
                        className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                        style={
                          msg.role === 'user'
                            ? {
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white',
                                borderBottomRightRadius: 6,
                              }
                            : {
                                background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                                color: 'var(--text-primary)',
                                borderBottomLeftRadius: 6,
                                backdropFilter: 'blur(12px)',
                              }
                        }
                      >
                        {msg.role === 'assistant' ? (
                          <MarkdownContent content={msg.content} />
                        ) : (
                          msg.content
                        )}
                      </div>

                      {/* Copy button for AI messages */}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="absolute -bottom-6 left-10 opacity-0 group-hover:opacity-100 transition-opacity text-xs flex items-center gap-1 px-2 py-0.5 rounded"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {copiedId === msg.id ? (
                            <>
                              <svg width={12} height={12} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              Copied
                            </>
                          ) : (
                            <>
                              <svg width={12} height={12} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2.5"
              >
                <div
                  className="flex-shrink-0 rounded-lg flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  }}
                >
                  <SparkleIcon size={16} />
                </div>
                <div
                  className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderBottomLeftRadius: 6,
                  }}
                >
                  <ThinkingDots />
                </div>
              </motion.div>
            )}

            {/* Quick suggestions after messages */}
            {!isLoading && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-1.5 pt-2"
              >
                {suggestions.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-80"
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              rows={1}
              className="glass-input w-full px-4 py-3 text-sm resize-none"
              style={{ color: 'var(--text-primary)', minHeight: 44, maxHeight: 120 }}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            type="submit"
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity"
            style={{
              width: 44,
              height: 44,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
            }}
          >
            <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </motion.button>
        </form>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{ width: 6, height: 6, background: 'var(--accent-primary)' }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function SparkleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"
        fill="white"
        opacity="0.6"
      />
    </svg>
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering
  const html = content
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-4 space-y-1 my-2">$1</ul>')
    // Line breaks
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="ai-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
