export const LEVELS = [
  { level: 1, xp: 0, title: 'Beginner' },
  { level: 2, xp: 100, title: 'Novice' },
  { level: 3, xp: 300, title: 'Apprentice' },
  { level: 4, xp: 600, title: 'Intermediate' },
  { level: 5, xp: 1000, title: 'Advanced' },
  { level: 6, xp: 1500, title: 'Expert' },
  { level: 7, xp: 2500, title: 'Master' },
  { level: 8, xp: 4000, title: 'Grandmaster' },
  { level: 9, xp: 6000, title: 'Legend' },
  { level: 10, xp: 10000, title: 'Finance God' },
];

export function getLevelForXP(xp: number): { level: number; title: string; currentXP: number; nextLevelXP: number; progress: number } {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.xp) current = l;
    else break;
  }

  const nextLevel = LEVELS.find((l) => l.level === current.level + 1);
  const nextXP = nextLevel ? nextLevel.xp : current.xp;
  const prevXP = current.xp;
  const progress = nextLevel ? Math.min(100, Math.round(((xp - prevXP) / (nextXP - prevXP)) * 100)) : 100;

  return {
    level: current.level,
    title: current.title,
    currentXP: xp,
    nextLevelXP: nextXP,
    progress,
  };
}

export const XP_REWARDS = {
  LOG_EXPENSE: 5,
  DAILY_STREAK: 2,
  FIRST_OF_DAY: 3,
  SCAN_RECEIPT: 10,
  SPLIT_EXPENSE: 5,
  COMPLETE_CHALLENGE: 100,
} as const;
