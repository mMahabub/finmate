import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';
import { query } from '@/lib/db';

// In-memory rate limiter
const rateLimits = new Map<string, { count: number; minuteCount: number; minuteReset: number; dayReset: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = rateLimits.get(userId);

  if (!entry || now > entry.dayReset) {
    entry = { count: 0, minuteCount: 0, minuteReset: now + 60000, dayReset: now + 86400000 };
  }

  if (now > entry.minuteReset) {
    entry.minuteCount = 0;
    entry.minuteReset = now + 60000;
  }

  if (entry.minuteCount >= 15) {
    return { allowed: false, retryAfter: Math.ceil((entry.minuteReset - now) / 1000) };
  }
  if (entry.count >= 1500) {
    return { allowed: false, retryAfter: Math.ceil((entry.dayReset - now) / 1000) };
  }

  entry.count++;
  entry.minuteCount++;
  rateLimits.set(userId, entry);
  return { allowed: true };
}

interface ConversationMessage {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

async function fetchUserFinancialData(userId: string) {
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Run all queries in parallel
  const [
    currentMonthExpenses,
    categoryBreakdown,
    budgetInfo,
    monthlyTrends,
    upcomingBills,
  ] = await Promise.all([
    // Current month total
    query<{ total: string; count: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
       FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3`,
      [userId, monthStart, monthEnd]
    ),
    // Category breakdown
    query<{ category: string; total: string; count: string }>(
      `SELECT category, SUM(amount) as total, COUNT(*) as count
       FROM expenses WHERE user_id = $1 AND date >= $2 AND date <= $3
       GROUP BY category ORDER BY total DESC`,
      [userId, monthStart, monthEnd]
    ),
    // Budget info
    query<{ category: string; budget_limit: string }>(
      `SELECT category, budget_limit FROM budgets WHERE user_id = $1 AND month = $2`,
      [userId, monthStart]
    ),
    // Monthly trends (last 6 months)
    query<{ month: string; total: string }>(
      `SELECT TO_CHAR(date_trunc('month', date), 'YYYY-MM') as month, SUM(amount) as total
       FROM expenses WHERE user_id = $1 AND date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY date_trunc('month', date) ORDER BY month DESC`,
      [userId]
    ),
    // Upcoming bills
    query<{ name: string; amount: string; next_due_date: string }>(
      `SELECT name, amount, TO_CHAR(next_due_date, 'YYYY-MM-DD') as next_due_date
       FROM bill_reminders WHERE user_id = $1 AND is_active = true
       ORDER BY next_due_date ASC LIMIT 5`,
      [userId]
    ),
  ]);

  const monthTotal = parseFloat(currentMonthExpenses[0]?.total || '0');
  const monthCount = parseInt(currentMonthExpenses[0]?.count || '0');

  const categories = categoryBreakdown.map((c) => ({
    category: c.category,
    total: parseFloat(c.total),
    count: parseInt(c.count),
  }));

  const totalBudget = budgetInfo.reduce((sum, b) => sum + parseFloat(b.budget_limit), 0);
  const budgetUsage = totalBudget > 0 ? Math.round((monthTotal / totalBudget) * 100) : null;

  const trends = monthlyTrends.map((t) => ({
    month: t.month,
    total: parseFloat(t.total),
  }));

  const bills = upcomingBills.map((b) => ({
    name: b.name,
    amount: parseFloat(b.amount),
    dueDate: b.next_due_date,
  }));

  return { monthTotal, monthCount, categories, totalBudget, budgetUsage, trends, bills };
}

function buildSystemPrompt(data: Awaited<ReturnType<typeof fetchUserFinancialData>>, currencySymbol: string) {
  const categoryList = data.categories
    .map((c) => `  - ${c.category}: ${currencySymbol}${c.total.toFixed(2)} (${c.count} transactions)`)
    .join('\n');

  const trendList = data.trends
    .map((t) => `  - ${t.month}: ${currencySymbol}${t.total.toFixed(2)}`)
    .join('\n');

  const billList = data.bills.length > 0
    ? data.bills.map((b) => `  - ${b.name}: ${currencySymbol}${b.amount.toFixed(2)} (due ${b.dueDate})`).join('\n')
    : '  No upcoming bills';

  const budgetLine = data.budgetUsage !== null
    ? `Monthly budget: ${currencySymbol}${data.totalBudget.toFixed(2)} (${data.budgetUsage}% used)`
    : 'No budget set for this month';

  return `You are FinMate AI, a helpful and friendly financial assistant for the FinMate expense tracking app.

You have access to the user's real financial data:

**Current Month Spending:** ${currencySymbol}${data.monthTotal.toFixed(2)} (${data.monthCount} transactions)
**${budgetLine}**

**Category Breakdown:**
${categoryList || '  No expenses yet this month'}

**Monthly Trends (last 6 months):**
${trendList || '  No historical data'}

**Upcoming Bills:**
${billList}

Guidelines:
- Be concise, friendly, and give actionable financial advice
- Use the currency symbol ${currencySymbol} for all amounts
- Format numbers with proper comma separators
- Use bold, lists, and short paragraphs for readability
- If asked something unrelated to finances, politely redirect: "I'm your financial assistant — I can help with spending, budgets, bills, and savings tips!"
- Respond in the same language the user writes in (support English and Bangla)
- Do not make up data — only reference the real data provided above
- When suggesting savings, be specific based on their actual spending patterns`;
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  // Check rate limit
  const rateCheck = checkRateLimit(auth.userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait a moment before trying again.', retryAfter: rateCheck.retryAfter },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { message, conversationHistory, currencySymbol } = body as {
      message: string;
      conversationHistory: ConversationMessage[];
      currencySymbol: string;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Fetch financial data
    const financialData = await fetchUserFinancialData(auth.userId);
    const symbol = currencySymbol || '$';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return fallback insights without AI
      return NextResponse.json({
        response: generateFallbackResponse(message, financialData, symbol),
        suggestions: generateSuggestions(financialData),
        fallback: true,
      });
    }

    // Build conversation for Gemini
    const systemPrompt = buildSystemPrompt(financialData, symbol);
    const history: ConversationMessage[] = conversationHistory || [];

    // Call Gemini API
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const chat = model.startChat({
      history: history.map((m) => ({
        role: m.role,
        parts: m.parts,
      })),
      systemInstruction: systemPrompt,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({
      response: responseText,
      suggestions: generateSuggestions(financialData),
      fallback: false,
    });
  } catch (error) {
    console.error('POST /api/ai/chat error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get AI response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateFallbackResponse(
  message: string,
  data: Awaited<ReturnType<typeof fetchUserFinancialData>>,
  symbol: string
): string {
  const msg = message.toLowerCase();

  if (msg.includes('spend') || msg.includes('how much') || msg.includes('total')) {
    if (data.monthCount === 0) {
      return "You haven't recorded any expenses this month yet. Start tracking to get insights!";
    }
    const categoryList = data.categories
      .map((c) => `- **${c.category}**: ${symbol}${c.total.toFixed(2)}`)
      .join('\n');
    return `This month you've spent **${symbol}${data.monthTotal.toFixed(2)}** across ${data.monthCount} transactions.\n\n**Breakdown:**\n${categoryList}`;
  }

  if (msg.includes('budget')) {
    if (data.budgetUsage === null) {
      return "You haven't set a budget for this month. Setting one helps you track spending limits!";
    }
    const status = data.budgetUsage > 90 ? 'almost reached' : data.budgetUsage > 70 ? 'getting close to' : 'within';
    return `You've used **${data.budgetUsage}%** of your ${symbol}${data.totalBudget.toFixed(2)} budget. You're ${status} your limit.`;
  }

  if (msg.includes('bill') || msg.includes('upcoming') || msg.includes('due')) {
    if (data.bills.length === 0) {
      return 'No upcoming bills found. You can add bill reminders to stay on top of payments!';
    }
    const billList = data.bills
      .map((b) => `- **${b.name}**: ${symbol}${b.amount.toFixed(2)} (due ${b.dueDate})`)
      .join('\n');
    return `**Upcoming Bills:**\n${billList}`;
  }

  if (msg.includes('trend') || msg.includes('compare') || msg.includes('last month')) {
    if (data.trends.length < 2) {
      return "Not enough data yet to show trends. Keep tracking and I'll have insights soon!";
    }
    const current = data.trends[0];
    const previous = data.trends[1];
    const change = ((current.total - previous.total) / previous.total * 100).toFixed(1);
    const direction = current.total > previous.total ? 'more' : 'less';
    return `**${current.month}**: ${symbol}${current.total.toFixed(2)}\n**${previous.month}**: ${symbol}${previous.total.toFixed(2)}\n\nYou spent **${Math.abs(parseFloat(change))}% ${direction}** this month compared to last month.`;
  }

  if (msg.includes('save') || msg.includes('reduce') || msg.includes('cut')) {
    if (data.categories.length === 0) {
      return 'Start tracking expenses and I can suggest where to save!';
    }
    const top = data.categories[0];
    return `Your highest spending category is **${top.category}** at ${symbol}${top.total.toFixed(2)}. Consider reviewing these expenses for potential savings.`;
  }

  if (msg.includes('category') || msg.includes('breakdown')) {
    if (data.categories.length === 0) {
      return 'No expenses recorded yet this month.';
    }
    const list = data.categories
      .map((c) => `- **${c.category}**: ${symbol}${c.total.toFixed(2)} (${c.count} transactions)`)
      .join('\n');
    return `**Category Breakdown:**\n${list}\n\nTotal: **${symbol}${data.monthTotal.toFixed(2)}**`;
  }

  // Default
  return `Here's your financial snapshot:\n\n- **This month**: ${symbol}${data.monthTotal.toFixed(2)} spent\n${data.budgetUsage !== null ? `- **Budget**: ${data.budgetUsage}% used\n` : ''}- **Top category**: ${data.categories[0]?.category || 'N/A'}\n- **Upcoming bills**: ${data.bills.length}\n\nAsk me about your spending, budget, trends, or savings tips!`;
}

function generateSuggestions(data: Awaited<ReturnType<typeof fetchUserFinancialData>>): string[] {
  const suggestions: string[] = [];

  if (data.monthCount > 0) {
    suggestions.push('How much did I spend this month?');
    suggestions.push('Category breakdown');
  }

  if (data.budgetUsage !== null) {
    suggestions.push('Am I within budget?');
  }

  if (data.trends.length >= 2) {
    suggestions.push('Compare this month to last month');
  }

  if (data.categories.length > 0) {
    suggestions.push('Where can I save money?');
  }

  if (data.bills.length > 0) {
    suggestions.push('Upcoming bills?');
  }

  suggestions.push("What's my spending trend?");

  return suggestions.slice(0, 6);
}
