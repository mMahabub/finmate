import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query, queryOne } from '@/lib/db';
import { getLevelForXP, XP_REWARDS } from '@/lib/gamification';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const action = (body.action as string) || 'expense_logged';

    // Ensure user_stats exists
    await queryOne(
      `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [auth.userId]
    );

    const stats = await queryOne<Record<string, unknown>>(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [auth.userId]
    );
    if (!stats) {
      return NextResponse.json({ error: 'Stats not found' }, { status: 500 });
    }

    let xpGained = 0;
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = stats.last_activity_date
      ? new Date(stats.last_activity_date as string).toISOString().split('T')[0]
      : null;
    const isNewDay = lastActivity !== today;

    // --- Update streak ---
    let newStreak = (stats.current_streak as number) || 0;
    let longestStreak = (stats.longest_streak as number) || 0;
    let totalDaysActive = (stats.total_days_active as number) || 0;

    if (isNewDay) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastActivity === yesterdayStr) {
        newStreak += 1;
      } else if (lastActivity === null) {
        newStreak = 1;
      } else {
        newStreak = 1; // Reset streak
      }

      if (newStreak > longestStreak) longestStreak = newStreak;
      totalDaysActive += 1;
      xpGained += XP_REWARDS.DAILY_STREAK;
      xpGained += XP_REWARDS.FIRST_OF_DAY;
    }

    // --- XP for action ---
    let totalExpenses = (stats.total_expenses_logged as number) || 0;

    switch (action) {
      case 'expense_logged':
        xpGained += XP_REWARDS.LOG_EXPENSE;
        totalExpenses += 1;
        break;
      case 'receipt_scanned':
        xpGained += XP_REWARDS.SCAN_RECEIPT;
        totalExpenses += 1;
        break;
      case 'split_expense':
        xpGained += XP_REWARDS.SPLIT_EXPENSE;
        break;
    }

    // --- Check badge conditions ---
    const newBadges: Array<{ name: string; icon: string; description: string; xpReward: number }> = [];

    const allBadges = await query<Record<string, unknown>>(
      `SELECT b.id, b.name, b.icon, b.description, b.xp_reward, b.requirement_type, b.requirement_value
       FROM badges b
       WHERE b.id NOT IN (SELECT badge_id FROM user_badges WHERE user_id = $1)`,
      [auth.userId]
    );

    // Get counts for badge checks
    const friendCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [auth.userId]
    );

    const progressValues: Record<string, number> = {
      streak_days: newStreak,
      total_expenses: totalExpenses,
      friends_count: parseInt(friendCount?.count || '0'),
      account_created: 1,
      budget_months: 0,
      split_groups: 0,
      settlements: 0,
      receipts_scanned: 0,
      ai_questions: 0,
    };

    for (const badge of allBadges) {
      const reqType = badge.requirement_type as string;
      const reqValue = badge.requirement_value as number;
      const currentVal = progressValues[reqType] || 0;

      if (currentVal >= reqValue) {
        // Award badge
        await queryOne(
          `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [auth.userId, badge.id]
        );
        const reward = badge.xp_reward as number;
        xpGained += reward;
        newBadges.push({
          name: badge.name as string,
          icon: badge.icon as string,
          description: badge.description as string,
          xpReward: reward,
        });
      }
    }

    // --- Update stats ---
    const newXP = ((stats.xp_points as number) || 0) + xpGained;
    const oldLevel = getLevelForXP((stats.xp_points as number) || 0);
    const newLevel = getLevelForXP(newXP);
    const levelUp = newLevel.level > oldLevel.level;

    await queryOne(
      `UPDATE user_stats SET
        xp_points = $2,
        level = $3,
        current_streak = $4,
        longest_streak = $5,
        last_activity_date = $6,
        total_expenses_logged = $7,
        total_days_active = $8,
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [auth.userId, newXP, newLevel.level, newStreak, longestStreak, today, totalExpenses, totalDaysActive]
    );

    // --- Check challenge completion ---
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const challenges = await query<Record<string, unknown>>(
      `SELECT mc.id, mc.challenge_type, mc.target_value, mc.category, mc.xp_reward
       FROM monthly_challenges mc
       LEFT JOIN user_challenges uc ON uc.challenge_id = mc.id AND uc.user_id = $1
       WHERE mc.month = $2 AND (uc.is_completed IS NULL OR uc.is_completed = false)`,
      [auth.userId, currentMonth]
    );

    for (const ch of challenges) {
      const type = ch.challenge_type as string;
      const target = parseFloat(ch.target_value as string);
      let completed = false;

      // Ensure user_challenges row exists
      await queryOne(
        `INSERT INTO user_challenges (user_id, challenge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [auth.userId, ch.id]
      );

      switch (type) {
        case 'daily_logging': {
          const days = await queryOne<{ count: string }>(
            `SELECT COUNT(DISTINCT date) as count FROM expenses WHERE user_id = $1 AND date >= $2 || '-01'`,
            [auth.userId, currentMonth]
          );
          const val = parseInt(days?.count || '0');
          await queryOne(
            `UPDATE user_challenges SET current_value = $3 WHERE user_id = $1 AND challenge_id = $2`,
            [auth.userId, ch.id, val]
          );
          if (val >= target) completed = true;
          break;
        }
        case 'friends_added': {
          const val = parseInt(friendCount?.count || '0');
          await queryOne(
            `UPDATE user_challenges SET current_value = $3 WHERE user_id = $1 AND challenge_id = $2`,
            [auth.userId, ch.id, val]
          );
          if (val >= target) completed = true;
          break;
        }
      }

      if (completed) {
        await queryOne(
          `UPDATE user_challenges SET is_completed = true, completed_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND challenge_id = $2`,
          [auth.userId, ch.id]
        );
        const chXP = (ch.xp_reward as number) || 100;
        xpGained += chXP;
        // Add challenge XP
        await queryOne(
          `UPDATE user_stats SET xp_points = xp_points + $2 WHERE user_id = $1`,
          [auth.userId, chXP]
        );
      }
    }

    return NextResponse.json({
      xpGained,
      newXP,
      newBadges,
      levelUp,
      newLevel: newLevel.level,
      newLevelTitle: newLevel.title,
      streak: newStreak,
      isNewDay,
    });
  } catch (error) {
    console.error('POST /api/gamification/check error:', error);
    return NextResponse.json({ error: 'Failed to check gamification' }, { status: 500 });
  }
}
