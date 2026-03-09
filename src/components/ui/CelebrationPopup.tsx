'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface BadgeEarned {
  name: string;
  icon: string;
  description: string;
  xpReward: number;
}

interface CelebrationData {
  type: 'badge' | 'level_up' | 'streak';
  badge?: BadgeEarned;
  level?: number;
  levelTitle?: string;
  streak?: number;
  xpGained?: number;
}

interface CelebrationPopupProps {
  celebration: CelebrationData | null;
  onDismiss: () => void;
}

export function CelebrationPopup({ celebration, onDismiss }: CelebrationPopupProps) {
  const fireConfetti = useCallback(() => {
    const duration = 2000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  useEffect(() => {
    if (celebration && (celebration.type === 'badge' || celebration.type === 'level_up')) {
      fireConfetti();
    }
  }, [celebration, fireConfetti]);

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="glass-card p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {celebration.type === 'badge' && celebration.badge && (
              <>
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(99,102,241,0.3)',
                      '0 0 40px rgba(168,85,247,0.4)',
                      '0 0 20px rgba(99,102,241,0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', fontSize: 40 }}
                >
                  {celebration.badge.icon}
                </motion.div>
                <h2 className="text-lg font-heading font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  New Badge Earned!
                </h2>
                <p className="text-xl font-bold mb-1" style={{ color: 'var(--accent-primary)' }}>
                  {celebration.badge.name}
                </p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {celebration.badge.description}
                </p>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                  style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}
                >
                  +{celebration.badge.xpReward} XP
                </motion.div>
              </>
            )}

            {celebration.type === 'level_up' && (
              <>
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className="text-6xl mb-4"
                >
                  🎉
                </motion.div>
                <h2 className="text-lg font-heading font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Level Up!
                </h2>
                <p className="text-3xl font-bold mb-1" style={{ color: 'var(--accent-primary)' }}>
                  Level {celebration.level}
                </p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  You&apos;re now a <strong>{celebration.levelTitle}</strong>
                </p>
              </>
            )}

            {celebration.type === 'streak' && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                  className="text-5xl mb-3"
                >
                  🔥
                </motion.div>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {celebration.streak} day streak!
                </p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Keep it up!
                </p>
              </>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onDismiss}
              className="btn-primary mt-5 px-6"
            >
              Awesome!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
