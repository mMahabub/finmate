import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = `${currentMonth}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();

    // Get challenges
    const challenges = await query<Record<string, unknown>>(
      `SELECT mc.id, mc.title, mc.description, mc.icon, mc.challenge_type,
              mc.target_value, mc.category, mc.xp_reward,
              uc.current_value, uc.is_completed, uc.completed_at
       FROM monthly_challenges mc
       LEFT JOIN user_challenges uc ON uc.challenge_id = mc.id AND uc.user_id = $1
       WHERE mc.month = $2
       ORDER BY mc.created_at`,
      [auth.userId, currentMonth]
    );

    // Calculate real progress for each challenge type
    const [monthTotal, categoryTotals, daysLogged, friendsAdded] = await Promise.all([
      queryOne<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [auth.userId, monthStart, monthEnd]
      ),
      query<{ category: string; total: string }>(
        `SELECT category, SUM(amount) as total FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3 GROUP BY category`,
        [auth.userId, monthStart, monthEnd]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(DISTINCT date) as count FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [auth.userId, monthStart, monthEnd]
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM friendships WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted' AND created_at >= $2`,
        [auth.userId, monthStart]
      ),
    ]);

    const catMap = new Map(categoryTotals.map((c) => [c.category, parseFloat(c.total)]));

    const result = challenges.map((ch) => {
      const type = ch.challenge_type as string;
      const target = parseFloat(ch.target_value as string);
      const category = ch.category as string | null;
      let currentValue = 0;

      switch (type) {
        case 'category_limit':
          // For limit challenges, progress = how much spent (lower is better)
          currentValue = catMap.get(category || '') || 0;
          break;
        case 'total_limit':
          currentValue = parseFloat(monthTotal?.total || '0');
          break;
        case 'daily_logging':
          currentValue = parseInt(daysLogged?.count || '0');
          break;
        case 'friends_added':
          currentValue = parseInt(friendsAdded?.count || '0');
          break;
      }

      const isLimitType = type === 'category_limit' || type === 'total_limit';
      const isCompleted = ch.is_completed as boolean || false;
      // For limit types: completed if under target at month end, progress shows usage
      const progressPercent = isLimitType
        ? Math.min(100, Math.round((currentValue / target) * 100))
        : Math.min(100, Math.round((currentValue / target) * 100));

      return {
        id: ch.id,
        title: ch.title,
        description: ch.description,
        icon: ch.icon,
        challengeType: type,
        targetValue: target,
        category,
        xpReward: ch.xp_reward,
        currentValue: Math.round(currentValue * 100) / 100,
        isCompleted,
        completedAt: ch.completed_at,
        progressPercent,
        isLimitType,
      };
    });

    return NextResponse.json({ challenges: result, daysRemaining, currentMonth });
  } catch (error) {
    console.error('GET /api/gamification/challenges error:', error);
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
}
