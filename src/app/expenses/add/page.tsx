'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useExpenses } from '@/hooks/useExpenses';
import { useBudgets } from '@/hooks/useBudgets';
import { ExpenseForm } from '@/components/expenses/ExpenseForm';
import { useToastContext } from '@/components/ui/ToastContainer';
import { useGamificationContext } from '@/components/layout/AppShell';
import { formatCurrency } from '@/lib/formatCurrency';
import Link from 'next/link';
import { Category } from '@/types/expense';

export default function AddExpensePage() {
  const router = useRouter();
  const { addExpense } = useExpenses();
  const { summary: budgetSummary } = useBudgets();
  const { addToast } = useToastContext();
  const { checkGamification } = useGamificationContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Food');

  const categoryStatus = budgetSummary.categoryStatuses.find(
    (s) => s.category === selectedCategory
  );

  async function handleSubmit(data: Parameters<typeof addExpense>[0]) {
    setIsSubmitting(true);
    try {
      await addExpense(data);

      if (categoryStatus && categoryStatus.budget > 0) {
        const newSpent = categoryStatus.spent + data.amount;
        const newPct = (newSpent / categoryStatus.budget) * 100;
        if (newPct >= 80 && categoryStatus.percentage < 80) {
          addToast(`${data.category} budget is at ${Math.round(newPct)}%!`, 'info');
        }
      }

      addToast('Expense added successfully', 'success');
      checkGamification('expense_logged');
      setTimeout(() => router.push('/expenses'), 600);
    } catch {
      addToast('Failed to add expense', 'error');
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
      <div className="mb-6">
        <Link href="/expenses" className="inline-flex items-center gap-1 text-sm mb-3 transition-colors" style={{ color: 'var(--text-muted)' }}>
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Expenses
        </Link>
        <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>Add Expense</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Record a new expense</p>
      </div>

      {categoryStatus && categoryStatus.budget > 0 && (
        <motion.div key={selectedCategory} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 glass-card px-4 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
            background: categoryStatus.status === 'over' ? 'var(--accent-coral)' : categoryStatus.status === 'warning' ? '#f59e0b' : 'var(--accent-teal)',
          }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedCategory}</span>
            {' budget: '}
            {formatCurrency(categoryStatus.remaining)} remaining of {formatCurrency(categoryStatus.budget)}
            {categoryStatus.status === 'over' && (<span style={{ color: 'var(--accent-coral)' }}> (over budget!)</span>)}
          </p>
        </motion.div>
      )}

      <div className="glass-card p-6">
        <ExpenseForm onSubmit={handleSubmit} isSubmitting={isSubmitting} onCategoryChange={setSelectedCategory} />
      </div>
    </motion.div>
  );
}
