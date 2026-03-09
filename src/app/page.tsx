'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useExpenses } from '@/hooks/useExpenses';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { MonthlyBarChart } from '@/components/dashboard/MonthlyBarChart';
import { ExpenseRow } from '@/components/expenses/ExpenseRow';
import { useToastContext } from '@/components/ui/ToastContainer';
import { BudgetSummaryCard } from '@/components/dashboard/BudgetSummaryCard';
import { useBudgets } from '@/hooks/useBudgets';
import { apiFetch } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/formatCurrency';
import { AIInsightCard } from '@/components/dashboard/AIInsightCard';

interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  category: string;
  nextDueDate: string;
  status: string;
}

export default function DashboardPage() {
  const { recentExpenses, isLoaded, summary, deleteExpense, totalCount, error, fetchStats } = useExpenses();
  const { addToast } = useToastContext();
  const { summary: budgetSummary } = useBudgets();
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);

  const fetchUpcomingBills = useCallback(async () => {
    try {
      const data = await apiFetch<{ bills: UpcomingBill[]; stats: { overdueCount: number } }>('/api/bills');
      const overdue = data.bills.filter((b) => b.status === 'overdue');
      const upcoming = data.bills.filter((b) => b.status === 'due_today' || b.status === 'upcoming').slice(0, 3);
      setOverdueCount(overdue.length);
      setUpcomingBills([...overdue.slice(0, 2), ...upcoming].slice(0, 3));
    } catch {
      // silently fail - bills section is optional
    }
  }, []);

  useEffect(() => {
    fetchUpcomingBills();
  }, [fetchUpcomingBills]);

  async function handleDelete(id: string) {
    try {
      await deleteExpense(id);
      addToast('Expense deleted', 'success');
    } catch {
      addToast('Failed to delete expense', 'error');
    }
  }

  if (!isLoaded) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-sm mb-4" style={{ color: 'var(--accent-coral)' }}>{error}</p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={fetchStats}
          className="btn-primary px-5 py-2.5"
        >
          Retry
        </motion.button>
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-8 shadow-xl"
          style={{ boxShadow: '0 12px 40px rgba(99, 102, 241, 0.3)' }}
        >
          <svg width={48} height={48} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>
        <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-2xl font-heading font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Welcome to FinMate
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mb-8 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Start tracking your expenses to see spending insights and analytics here.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Link href="/expenses/add" className="btn-primary inline-flex items-center gap-2 px-6 py-3">
            <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Your First Expense
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {overdueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 flex items-center gap-3"
          style={{ borderLeft: '4px solid var(--accent-coral)', background: 'rgba(255, 107, 107, 0.08)' }}
        >
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="var(--accent-coral)">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--accent-coral)' }}>
              {overdueCount} bill{overdueCount > 1 ? 's' : ''} overdue
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Check your bills to avoid late fees</p>
          </div>
          <Link href="/bills" className="text-sm font-medium" style={{ color: 'var(--accent-coral)' }}>
            View Bills &rarr;
          </Link>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your spending overview</p>
        </div>
        <Link href="/expenses/add" className="btn-primary inline-flex items-center gap-2">
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Expense
        </Link>
      </motion.div>

      <SummaryCards
        total={summary.total}
        monthlyTotal={summary.monthlyTotal}
        dailyAverage={summary.dailyAverage}
        topCategory={summary.topCategory}
      />

      <AIInsightCard />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetSummaryCard budget={budgetSummary} />
        <CategoryPieChart data={summary.categoryBreakdown} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyBarChart data={summary.monthlyTrend} />
      </div>

      {upcomingBills.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming Bills</h2>
            <Link href="/bills" className="text-sm font-medium transition-colors" style={{ color: 'var(--accent-primary)' }}>View all &rarr;</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {upcomingBills.map((bill, i) => {
              const dueDate = new Date(bill.nextDueDate + 'T00:00:00');
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
              const isOverdue = diffDays < 0;
              const isDueToday = diffDays === 0;

              return (
                <motion.div
                  key={bill.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="glass-card p-4"
                  style={{
                    borderLeft: `3px solid ${isOverdue ? 'var(--accent-coral)' : isDueToday ? '#3b82f6' : '#eab308'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{bill.name}</p>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        color: isOverdue ? '#ef4444' : isDueToday ? '#3b82f6' : '#eab308',
                        background: isOverdue ? 'rgba(239,68,68,0.1)' : isDueToday ? 'rgba(59,130,246,0.1)' : 'rgba(234,179,8,0.1)',
                      }}
                    >
                      {isOverdue ? `${Math.abs(diffDays)}d overdue` : isDueToday ? 'Today' : `${diffDays}d`}
                    </span>
                  </div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(bill.amount)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Due {bill.nextDueDate}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Expenses</h2>
          <Link href="/expenses" className="text-sm font-medium transition-colors" style={{ color: 'var(--accent-primary)' }}>View all &rarr;</Link>
        </div>
        <div className="space-y-2">
          {recentExpenses.map((expense, i) => (
            <ExpenseRow key={expense.id} expense={expense} onDelete={handleDelete} index={i} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="skeleton h-10 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (<div key={i} className="skeleton h-32" />))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skeleton h-80" />
        <div className="skeleton h-80" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (<div key={i} className="skeleton h-20" />))}
      </div>
    </div>
  );
}
