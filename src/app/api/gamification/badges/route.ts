import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const badges = await query<Record<string, unknown>>(
      `SELECT b.id, b.name, b.description, b.icon, b.category, b.xp_reward,
              b.requirement_type, b.requirement_value,
              ub.earned_at
       FROM badges b
       LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1
       ORDER BY b.category, b.requirement_value ASC`,
      [auth.userId]
    );

    // Get progress data
    const stats = await queryOne<Record<string, unknown>>(
      `SELECT current_streak, total_expenses_logged FROM user_stats WHERE user_id = $1`,
      [auth.userId]
    );

    const friendCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
      [auth.userId]
    );

    const progressMap: Record<string, number> = {
      streak_days: (stats?.current_streak as number) || 0,
      total_expenses: (stats?.total_expenses_logged as number) || 0,
      friends_count: parseInt(friendCount?.count || '0'),
      account_created: 1,
      budget_months: 0,
      split_groups: 0,
      settlements: 0,
      receipts_scanned: 0,
      ai_questions: 0,
    };

    const result = badges.map((b) => {
      const reqType = b.requirement_type as string;
      const reqValue = b.requirement_value as number;
      const currentProgress = progressMap[reqType] || 0;

      return {
        id: b.id,
        name: b.name,
        description: b.description,
        icon: b.icon,
        category: b.category,
        xpReward: b.xp_reward,
        requirementType: reqType,
        requirementValue: reqValue,
        earned: !!b.earned_at,
        earnedAt: b.earned_at,
        progress: Math.min(currentProgress, reqValue),
        progressPercent: Math.min(100, Math.round((currentProgress / reqValue) * 100)),
      };
    });

    return NextResponse.json({ badges: result });
  } catch (error) {
    console.error('GET /api/gamification/badges error:', error);
    return NextResponse.json({ error: 'Failed to fetch badges' }, { status: 500 });
  }
}
