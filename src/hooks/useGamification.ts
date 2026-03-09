'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/apiClient';

interface GamificationResult {
  xpGained: number;
  newXP: number;
  newBadges: Array<{ name: string; icon: string; description: string; xpReward: number }>;
  levelUp: boolean;
  newLevel: number;
  newLevelTitle: string;
  streak: number;
  isNewDay: boolean;
}

interface CelebrationData {
  type: 'badge' | 'level_up' | 'streak';
  badge?: { name: string; icon: string; description: string; xpReward: number };
  level?: number;
  levelTitle?: string;
  streak?: number;
  xpGained?: number;
}

export function useGamification() {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);

  const checkGamification = useCallback(async (action: string = 'expense_logged'): Promise<GamificationResult | null> => {
    try {
      const result = await apiFetch<GamificationResult>('/api/gamification/check', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });

      // Show celebrations in priority order
      if (result.newBadges.length > 0) {
        setCelebration({
          type: 'badge',
          badge: result.newBadges[0],
          xpGained: result.xpGained,
        });
      } else if (result.levelUp) {
        setCelebration({
          type: 'level_up',
          level: result.newLevel,
          levelTitle: result.newLevelTitle,
        });
      } else if (result.isNewDay && result.streak > 1 && result.streak % 5 === 0) {
        // Show streak celebration every 5 days
        setCelebration({
          type: 'streak',
          streak: result.streak,
        });
      }

      return result;
    } catch {
      return null;
    }
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  return { checkGamification, celebration, dismissCelebration };
}
