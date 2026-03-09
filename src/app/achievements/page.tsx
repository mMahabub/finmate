'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
  progress: number;
  progressPercent: number;
  requirementValue: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  challengeType: string;
  targetValue: number;
  xpReward: number;
  currentValue: number;
  isCompleted: boolean;
  progressPercent: number;
  isLimitType: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  levelTitle: string;
  streak: number;
  isCurrentUser: boolean;
}

interface Stats {
  xp: number;
  level: number;
  levelTitle: string;
  nextLevelXP: number;
  levelProgress: number;
  currentStreak: number;
  longestStreak: number;
  badgesEarned: number;
  badgesTotal: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  streak: 'Streak',
  budget: 'Budget',
  logging: 'Logging',
  social: 'Social',
  milestone: 'Milestone',
  special: 'Special',
};

const RANK_STYLES = [
  { bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)', icon: '👑' },
  { bg: 'linear-gradient(135deg, #94a3b8, #64748b)', icon: '🥈' },
  { bg: 'linear-gradient(135deg, #d97706, #b45309)', icon: '🥉' },
];

export default function AchievementsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<'badges' | 'challenges' | 'leaderboard'>('badges');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [s, b, c, l] = await Promise.all([
          apiFetch<Stats>('/api/gamification/stats'),
          apiFetch<{ badges: Badge[] }>('/api/gamification/badges'),
          apiFetch<{ challenges: Challenge[]; daysRemaining: number }>('/api/gamification/challenges'),
          apiFetch<{ leaderboard: LeaderboardEntry[] }>('/api/gamification/leaderboard'),
        ]);
        setStats(s);
        setBadges(b.badges);
        setChallenges(c.challenges);
        setDaysRemaining(c.daysRemaining);
        setLeaderboard(l.leaderboard);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
          Achievements
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Track your progress and earn rewards
        </p>
      </motion.div>

      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Level & XP */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
              >
                {stats.level}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {stats.levelTitle}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {stats.xp} / {stats.nextLevelXP} XP
                </p>
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.levelProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #6366f1, #a855f7)' }}
              />
            </div>
          </motion.div>

          {/* Streak */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="glass-card p-5 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-4xl mb-1"
            >
              🔥
            </motion.div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {stats.currentStreak}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Day Streak (Best: {stats.longestStreak})
            </p>
          </motion.div>

          {/* Badges count */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="glass-card p-5 text-center"
          >
            <div className="text-4xl mb-1">🏅</div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {stats.badgesEarned}
              <span className="text-base font-normal" style={{ color: 'var(--text-muted)' }}>
                {' '}/ {stats.badgesTotal}
              </span>
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Badges Earned</p>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        {(['badges', 'challenges', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t ? 'var(--accent-primary)' : 'transparent',
              color: tab === t ? 'white' : 'var(--text-secondary)',
            }}
          >
            {t === 'badges' ? `Badges (${stats?.badgesEarned || 0})` : t === 'challenges' ? 'Challenges' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'badges' && <BadgesGrid badges={badges} />}
      {tab === 'challenges' && <ChallengesSection challenges={challenges} daysRemaining={daysRemaining} />}
      {tab === 'leaderboard' && <LeaderboardSection entries={leaderboard} />}
    </div>
  );
}

function BadgesGrid({ badges }: { badges: Badge[] }) {
  const grouped = badges.reduce<Record<string, Badge[]>>((acc, b) => {
    (acc[b.category] ||= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
            {CATEGORY_LABELS[category] || category}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -3 }}
                className="glass-card p-4 text-center relative overflow-hidden"
                style={{
                  opacity: badge.earned ? 1 : 0.5,
                  filter: badge.earned ? 'none' : 'grayscale(0.8)',
                }}
              >
                {badge.earned && (
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    animate={{
                      boxShadow: [
                        'inset 0 0 10px rgba(99,102,241,0.05)',
                        'inset 0 0 20px rgba(99,102,241,0.1)',
                        'inset 0 0 10px rgba(99,102,241,0.05)',
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                )}
                <div className="text-3xl mb-2">{badge.icon}</div>
                <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                  {badge.name}
                </p>
                <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                  {badge.description}
                </p>
                {!badge.earned && (
                  <>
                    <div className="w-full h-1.5 rounded-full mb-1" style={{ background: 'var(--card-border)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${badge.progressPercent}%`,
                          background: 'var(--accent-primary)',
                        }}
                      />
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {badge.progress} / {badge.requirementValue}
                    </p>
                  </>
                )}
                {badge.earned && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                  >
                    +{badge.xpReward} XP
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChallengesSection({ challenges, daysRemaining }: { challenges: Challenge[]; daysRemaining: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Monthly Challenges
        </p>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
          {daysRemaining} days left
        </span>
      </div>
      {challenges.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No challenges this month yet
        </p>
      )}
      {challenges.map((ch, i) => (
        <motion.div
          key={ch.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="glass-card p-4"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl flex-shrink-0">{ch.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {ch.title}
                </p>
                {ch.isCompleted ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Completed
                  </span>
                ) : (
                  <span className="text-xs font-bold flex-shrink-0 ml-2" style={{ color: 'var(--accent-primary)' }}>
                    +{ch.xpReward} XP
                  </span>
                )}
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{ch.description}</p>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--card-border)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ch.progressPercent}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    background: ch.isCompleted
                      ? '#22c55e'
                      : ch.isLimitType && ch.progressPercent > 80
                      ? '#ef4444'
                      : 'var(--accent-primary)',
                  }}
                />
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {ch.isLimitType
                  ? `${ch.currentValue.toFixed(0)} / ${ch.targetValue.toFixed(0)} spent`
                  : `${ch.currentValue} / ${ch.targetValue}`
                }
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          Add friends to see the leaderboard!
        </p>
      )}
      {entries.map((entry, i) => (
        <motion.div
          key={entry.userId}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="glass-card p-4 flex items-center gap-3"
          style={{
            border: entry.isCurrentUser ? '1px solid var(--accent-primary)' : undefined,
            background: entry.isCurrentUser ? 'rgba(99,102,241,0.04)' : undefined,
          }}
        >
          {/* Rank */}
          <div className="flex-shrink-0 w-8 text-center">
            {entry.rank <= 3 ? (
              <span className="text-lg">{RANK_STYLES[entry.rank - 1].icon}</span>
            ) : (
              <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                #{entry.rank}
              </span>
            )}
          </div>

          {/* Avatar */}
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt={entry.name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
            >
              {entry.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {entry.name}
              </p>
              {entry.isCurrentUser && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-primary)', color: 'white' }}>
                  You
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Lv.{entry.level} {entry.levelTitle}
            </p>
          </div>

          {/* Stats */}
          <div className="text-right flex-shrink-0">
            <p className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>
              {entry.xp.toLocaleString()} XP
            </p>
            {entry.streak > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                🔥 {entry.streak}d
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
