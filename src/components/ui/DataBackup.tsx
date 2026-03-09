'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Expense, BudgetData, CurrencyCode } from '@/types/expense';
import { exportBackupJSON, parseBackupJSON } from '@/lib/export';

interface DataBackupProps {
  expenses: Expense[];
  budgets: BudgetData | null;
  currency: CurrencyCode;
  onRestore: (expenses: Expense[], budgets: BudgetData | null, currency: CurrencyCode) => void;
}

export function DataBackup({ expenses, budgets, currency, onRestore }: DataBackupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportBackupJSON(expenses, budgets, currency);
  }

  function handleImport() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseBackupJSON(text);
      if (data) {
        if (window.confirm(`This will replace all current data with ${data.expenses.length} expenses from the backup. Continue?`)) {
          onRestore(data.expenses, data.budgets, data.currency);
        }
      } else {
        alert('Invalid backup file. Please select a valid FinMate backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleExport}
        className="btn-ghost inline-flex items-center gap-2 text-sm"
        title="Export all data as JSON backup"
      >
        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        Backup
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleImport}
        className="btn-ghost inline-flex items-center gap-2 text-sm"
        title="Restore data from JSON backup"
      >
        <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
        Restore
      </motion.button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
