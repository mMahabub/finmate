'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';

export function AIInsightCard() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInsight() {
      try {
        const data = await apiFetch<{ insight: string }>('/api/ai/insight');
        setInsight(data.insight);
      } catch {
        setInsight(null);
      } finally {
        setLoading(false);
      }
    }
    fetchInsight();
  }, []);

  if (loading) {
    return <div className="skeleton h-24 rounded-2xl" />;
  }

  if (!insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Link href="/ai-assistant" className="block">
        <div
          className="glass-card p-5 transition-all duration-200 hover:shadow-lg group cursor-pointer"
          style={{ borderLeft: '3px solid var(--accent-primary)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 rounded-lg flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-primary)' }}>
                  AI Insight
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {insight}
              </p>
              <p
                className="text-xs mt-2 font-medium group-hover:underline"
                style={{ color: 'var(--accent-primary)' }}
              >
                Ask FinMate AI for more &rarr;
              </p>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
