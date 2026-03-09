import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { queryOne, query } from '@/lib/db';
import { getLevelForXP } from '@/lib/gamification';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Ensure user_stats row exists
    await queryOne(
      `INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [auth.userId]
    );

    const stats = await queryOne<Record<string, unknown>>(
      `SELECT xp_points, level, current_streak, longest_streak,
              last_activity_date, total_expenses_logged, total_days_active
       FROM user_stats WHERE user_id = $1`,
      [auth.userId]
    );

    if (!stats) {
      return NextResponse.json({ error: 'Stats not found' }, { status: 404 });
    }

    const xp = stats.xp_points as number;
    const levelInfo = getLevelForXP(xp);

    // Count earned badges
    const badgeCount = await queryOne<{ earned: string; total: string }>(
      `SELECT
        (SELECT COUNT(*) FROM user_badges WHERE user_id = $1) as earned,
        (SELECT COUNT(*) FROM badges) as total`,
      [auth.userId]
    );

    return NextResponse.json({
      xp: xp,
      level: levelInfo.level,
      levelTitle: levelInfo.title,
      nextLevelXP: levelInfo.nextLevelXP,
      levelProgress: levelInfo.progress,
      currentStreak: stats.current_streak,
      longestStreak: stats.longest_streak,
      totalExpensesLogged: stats.total_expenses_logged,
      totalDaysActive: stats.total_days_active,
      badgesEarned: parseInt(badgeCount?.earned || '0'),
      badgesTotal: parseInt(badgeCount?.total || '0'),
    });
  } catch (error) {
    console.error('GET /api/gamification/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
