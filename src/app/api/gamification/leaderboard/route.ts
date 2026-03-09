import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query } from '@/lib/db';
import { getLevelForXP } from '@/lib/gamification';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    // Get friends + self with their stats
    const rows = await query<Record<string, unknown>>(
      `SELECT u.id, u.name, u.avatar_url, us.xp_points, us.current_streak
       FROM users u
       JOIN user_stats us ON us.user_id = u.id
       WHERE u.id = $1
          OR u.id IN (
            SELECT CASE WHEN user_id = $1 THEN friend_id ELSE user_id END
            FROM friendships
            WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'
          )
       ORDER BY us.xp_points DESC`,
      [auth.userId]
    );

    const leaderboard = rows.map((row, index) => {
      const xp = (row.xp_points as number) || 0;
      const levelInfo = getLevelForXP(xp);
      return {
        rank: index + 1,
        userId: row.id,
        name: row.name,
        avatarUrl: row.avatar_url,
        xp,
        level: levelInfo.level,
        levelTitle: levelInfo.title,
        streak: (row.current_streak as number) || 0,
        isCurrentUser: row.id === auth.userId,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('GET /api/gamification/leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
