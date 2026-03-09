import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevStart = `${prevMonthStart.getFullYear()}-${String(prevMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
    const prevEnd = new Date(prevMonthStart.getFullYear(), prevMonthStart.getMonth() + 1, 0).toISOString().split('T')[0];

    const [currentMonth, prevMonth, topCategory, budgetInfo, highestDay] = await Promise.all([
      query<{ total: string; count: string }>(
        `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [auth.userId, monthStart, monthEnd]
      ),
      query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3`,
        [auth.userId, prevStart, prevEnd]
      ),
      query<{ category: string; total: string }>(
        `SELECT category, SUM(amount) as total
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY category ORDER BY total DESC LIMIT 1`,
        [auth.userId, monthStart, monthEnd]
      ),
      query<{ budget_limit: string }>(
        `SELECT SUM(budget_limit) as budget_limit FROM budgets WHERE user_id = $1 AND month = $2`,
        [auth.userId, monthStart]
      ),
      query<{ day_name: string; total: string }>(
        `SELECT TO_CHAR(date, 'Day') as day_name, SUM(amount) as total
         FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
         GROUP BY TO_CHAR(date, 'Day') ORDER BY total DESC LIMIT 1`,
        [auth.userId, monthStart, monthEnd]
      ),
    ]);

    const curTotal = parseFloat(currentMonth[0]?.total || '0');
    const prvTotal = parseFloat(prevMonth[0]?.total || '0');
    const count = parseInt(currentMonth[0]?.count || '0');
    const budget = parseFloat(budgetInfo[0]?.budget_limit || '0');
    const budgetPct = budget > 0 ? Math.round((curTotal / budget) * 100) : null;

    // Generate insight based on data
    const insights: string[] = [];

    if (count === 0) {
      insights.push("Start tracking your expenses today to get personalized financial insights!");
    } else {
      // Month-over-month comparison
      if (prvTotal > 0) {
        const change = ((curTotal - prvTotal) / prvTotal * 100).toFixed(0);
        if (curTotal > prvTotal) {
          insights.push(`You've spent ${change}% more this month than last month.`);
        } else {
          insights.push(`Great job! You've spent ${Math.abs(parseInt(change))}% less than last month.`);
        }
      }

      // Budget status
      if (budgetPct !== null) {
        if (budgetPct > 90) {
          insights.push(`Warning: You've used ${budgetPct}% of your budget!`);
        } else if (budgetPct > 70) {
          insights.push(`Heads up: You've used ${budgetPct}% of your budget.`);
        } else {
          insights.push(`You're on track — ${budgetPct}% of budget used.`);
        }
      }

      // Top category
      if (topCategory[0]) {
        insights.push(`Your biggest spending category is ${topCategory[0].category}.`);
      }

      // Highest spending day
      if (highestDay[0]) {
        insights.push(`${highestDay[0].day_name.trim()}s tend to be your highest spending days.`);
      }
    }

    // Pick one insight (rotate daily)
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const insight = insights[dayOfYear % insights.length] || insights[0] || 'Add expenses to see insights!';

    return NextResponse.json({ insight, allInsights: insights });
  } catch (error) {
    console.error('GET /api/ai/insight error:', error);
    return NextResponse.json({ error: 'Failed to generate insight' }, { status: 500 });
  }
}
