import { Expense, BudgetData, CurrencyCode, AppBackupData } from '@/types/expense';
import { format, parseISO } from 'date-fns';
import { formatCurrency } from './formatCurrency';

export function exportToCSV(expenses: Expense[], filename = 'expenses.csv'): void {
  const headers = ['Date', 'Category', 'Description', 'Amount', 'Recurring'];
  const rows = expenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((e) => [
      format(parseISO(e.date), 'yyyy-MM-dd'),
      e.category,
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      e.recurring && e.recurring !== 'none' ? e.recurring : '',
    ]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  rows.push(['', '', '"TOTAL"', total.toFixed(2), '']);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportToPDF(expenses: Expense[]): void {
  const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = new Map<string, number>();
  expenses.forEach((e) => {
    categoryTotals.set(e.category, (categoryTotals.get(e.category) || 0) + e.amount);
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
  .header h1 { font-size: 24px; color: #6366f1; }
  .header p { color: #666; font-size: 13px; margin-top: 4px; }
  .summary { display: flex; gap: 16px; margin-bottom: 24px; }
  .summary-card { flex: 1; background: #f8f9fa; border-radius: 8px; padding: 16px; text-align: center; }
  .summary-card .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-top: 4px; }
  .section-title { font-size: 16px; font-weight: 600; margin: 24px 0 12px; color: #1a1a2e; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #6366f1; color: white; padding: 10px 12px; text-align: left; font-weight: 500; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .amount { text-align: right; font-weight: 600; color: #ef4444; }
  .total-row td { font-weight: 700; border-top: 2px solid #6366f1; background: #f0f0ff !important; }
  .cat-bar { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
  .cat-bar .bar { height: 8px; border-radius: 4px; background: #6366f1; }
  .cat-bar .cat-name { font-size: 12px; width: 120px; }
  .cat-bar .cat-amount { font-size: 12px; color: #666; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #999; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <h1>Expense Report</h1>
  <p>Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
</div>
<div class="summary">
  <div class="summary-card">
    <div class="label">Total Expenses</div>
    <div class="value">${formatCurrency(total)}</div>
  </div>
  <div class="summary-card">
    <div class="label">Transactions</div>
    <div class="value">${expenses.length}</div>
  </div>
  <div class="summary-card">
    <div class="label">Average</div>
    <div class="value">${formatCurrency(expenses.length > 0 ? total / expenses.length : 0)}</div>
  </div>
</div>

<div class="section-title">Category Breakdown</div>
${Array.from(categoryTotals.entries())
  .sort((a, b) => b[1] - a[1])
  .map(([cat, amt]) => `
    <div class="cat-bar">
      <span class="cat-name">${cat}</span>
      <div class="bar" style="width: ${(amt / total) * 100}%"></div>
      <span class="cat-amount">${formatCurrency(amt)} (${((amt / total) * 100).toFixed(0)}%)</span>
    </div>
  `).join('')}

<div class="section-title">All Transactions</div>
<table>
  <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    ${sorted.map((e) => `
      <tr>
        <td>${format(parseISO(e.date), 'MMM d, yyyy')}</td>
        <td>${e.category}</td>
        <td>${e.description}${e.recurring && e.recurring !== 'none' ? ` (${e.recurring})` : ''}</td>
        <td class="amount">${formatCurrency(e.amount)}</td>
      </tr>
    `).join('')}
    <tr class="total-row">
      <td colspan="3">Total</td>
      <td class="amount">${formatCurrency(total)}</td>
    </tr>
  </tbody>
</table>
<div class="footer">FinMate &middot; Expense Report</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

export function exportBackupJSON(
  expenses: Expense[],
  budgets: BudgetData | null,
  currency: CurrencyCode
): void {
  const backup: AppBackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    budgets,
    currency,
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `finmate-backup-${format(new Date(), 'yyyy-MM-dd')}.json`);
}

export function parseBackupJSON(jsonString: string): AppBackupData | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version || !Array.isArray(data.expenses)) {
      return null;
    }
    return data as AppBackupData;
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
