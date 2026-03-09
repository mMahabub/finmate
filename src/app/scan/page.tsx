'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '@/lib/apiClient';
import { useToastContext } from '@/components/ui/ToastContainer';
import { useGamificationContext } from '@/components/layout/AppShell';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '@/lib/constants';
import { Category } from '@/types/expense';
import Link from 'next/link';

interface ScanResult {
  rawText: string;
  parsed: {
    amount: number | null;
    date: string | null;
    merchant: string | null;
    suggestedCategory: string;
    confidence: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
  success: boolean;
}

export default function ScanReceiptPage() {
  const router = useRouter();
  const { addToast } = useToastContext();
  const { checkGamification } = useGamificationContext();

  const [step, setStep] = useState<'upload' | 'scanning' | 'results'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Editable result fields
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [showRawText, setShowRawText] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      addToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      addToast('Image must be under 10MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setStep('scanning');
      scanReceipt(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function scanReceipt(base64Data: string) {
    try {
      const result = await apiFetch<ScanResult>('/api/receipts/scan', {
        method: 'POST',
        body: JSON.stringify({ image: base64Data }),
      });

      setScanResult(result);
      setAmount(result.parsed.amount !== null ? result.parsed.amount.toString() : '');
      setDescription(result.parsed.merchant || '');
      setDate(result.parsed.date || new Date().toISOString().split('T')[0]);
      const suggested = result.parsed.suggestedCategory as Category;
      if (CATEGORIES.includes(suggested)) {
        setCategory(suggested);
      } else {
        setCategory('Other');
      }
      setStep('results');
    } catch {
      addToast('Failed to scan receipt. Please try again.', 'error');
      setStep('upload');
    }
  }

  async function handleAddExpense() {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      addToast('Please enter a valid amount', 'error');
      return;
    }
    if (!description.trim()) {
      addToast('Please enter a description', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(parseFloat(amount).toFixed(2)),
          category,
          description: description.trim(),
          date,
        }),
      });
      addToast('Expense added successfully', 'success');
      checkGamification('receipt_scanned');
      setTimeout(() => router.push('/expenses'), 600);
    } catch {
      addToast('Failed to add expense', 'error');
      setIsSubmitting(false);
    }
  }

  function resetScanner() {
    setStep('upload');
    setImagePreview(null);
    setScanResult(null);
    setAmount('');
    setDescription('');
    setDate('');
    setCategory('Other');
    setShowRawText(false);
    setIsSubmitting(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  const confidenceColor =
    scanResult?.parsed.confidenceLevel === 'high'
      ? '#22c55e'
      : scanResult?.parsed.confidenceLevel === 'medium'
      ? '#eab308'
      : '#ef4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto"
    >
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1 text-sm mb-3 transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Expenses
        </Link>
        <h1 className="text-2xl font-heading font-bold" style={{ color: 'var(--text-primary)' }}>
          Scan Receipt
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Take a photo or upload a receipt to auto-fill expense details
        </p>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/webp"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="glass-card flex flex-col items-center justify-center gap-4 p-8 cursor-pointer transition-all duration-200"
              style={{
                minHeight: '300px',
                border: isDragging
                  ? '2px dashed var(--accent-primary)'
                  : '2px dashed var(--card-border)',
                background: isDragging ? 'rgba(99, 102, 241, 0.05)' : undefined,
              }}
              onClick={() => uploadInputRef.current?.click()}
            >
              {/* Camera icon */}
              <div
                className="rounded-2xl p-4"
                style={{ background: 'rgba(99, 102, 241, 0.1)' }}
              >
                <svg
                  width={48}
                  height={48}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="var(--accent-primary)"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                  />
                </svg>
              </div>

              <div className="text-center">
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  Drop receipt image here
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  or
                </p>
              </div>

              <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Take Photo
                </button>
                <button
                  type="button"
                  className="btn-ghost px-4 py-2.5 text-sm flex items-center gap-2"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  Upload Image
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Scanning */}
        {step === 'scanning' && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="glass-card p-6"
          >
            {imagePreview && (
              <div className="mb-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                  src={imagePreview}
                  alt="Receipt preview"
                  className="rounded-xl"
                  style={{ maxHeight: '300px', objectFit: 'contain' }}
                />
              </div>
            )}

            <p
              className="text-center font-medium mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Scanning receipt...
            </p>

            {/* Scanning animation bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ height: '4px', background: 'var(--card-border)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: '40%',
                  background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-teal))',
                }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              />
            </div>
          </motion.div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && scanResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            {/* Image preview */}
            {imagePreview && (
              <div className="glass-card p-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                  src={imagePreview}
                  alt="Receipt"
                  className="rounded-xl"
                  style={{ maxHeight: '200px', objectFit: 'contain' }}
                />
              </div>
            )}

            {/* Confidence indicator */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Scan Confidence
                </span>
                <div className="flex items-center gap-1.5">
                  {scanResult.parsed.confidenceLevel === 'high' && (
                    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#22c55e">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {scanResult.parsed.confidenceLevel === 'medium' && (
                    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#eab308">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  )}
                  {scanResult.parsed.confidenceLevel === 'low' && (
                    <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#ef4444">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className="text-sm font-medium" style={{ color: confidenceColor }}>
                    {scanResult.parsed.confidenceLevel === 'high'
                      ? 'High confidence'
                      : scanResult.parsed.confidenceLevel === 'medium'
                      ? 'Medium confidence'
                      : 'Low confidence'}
                  </span>
                </div>
              </div>
              <div
                className="rounded-full overflow-hidden"
                style={{ height: '6px', background: 'var(--card-border)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: confidenceColor }}
                  initial={{ width: 0 }}
                  animate={{ width: `${scanResult.parsed.confidence}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>

            {/* Editable form */}
            <div className="glass-card p-6 space-y-5">
              {/* Amount */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="glass-input w-full px-4 py-3 text-lg font-heading font-bold"
                  style={{
                    color: 'var(--text-primary)',
                    background: scanResult.parsed.amount === null ? 'rgba(234, 179, 8, 0.08)' : undefined,
                    borderColor: scanResult.parsed.amount === null ? 'rgba(234, 179, 8, 0.4)' : undefined,
                  }}
                />
                {scanResult.parsed.amount === null && (
                  <p className="text-xs mt-1" style={{ color: '#eab308' }}>
                    No amount detected — please enter manually
                  </p>
                )}
              </motion.div>

              {/* Description / Merchant */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Description / Merchant
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Lunch at restaurant"
                  className="glass-input w-full px-4 py-3 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </motion.div>

              {/* Date */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="glass-input w-full px-4 py-3 text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
              </motion.div>

              {/* Category */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <motion.button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        whileTap={{ scale: 0.95 }}
                        className="relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200"
                        style={{
                          background: isSelected
                            ? `${CATEGORY_COLORS[cat]}18`
                            : 'var(--input-bg)',
                          border: isSelected
                            ? `2px solid ${CATEGORY_COLORS[cat]}`
                            : '2px solid var(--input-border)',
                          color: isSelected ? CATEGORY_COLORS[cat] : 'var(--text-secondary)',
                        }}
                      >
                        <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                        <span className="text-xs truncate">{cat}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Raw Text Toggle */}
              {scanResult.rawText && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <button
                    type="button"
                    onClick={() => setShowRawText(!showRawText)}
                    className="flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <motion.svg
                      width={16}
                      height={16}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      animate={{ rotate: showRawText ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </motion.svg>
                    View Raw Text
                  </button>
                  <AnimatePresence>
                    {showRawText && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <pre
                          className="glass-card mt-2 p-4 text-xs overflow-auto whitespace-pre-wrap"
                          style={{
                            maxHeight: '200px',
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {scanResult.rawText}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <motion.button
                type="button"
                onClick={handleAddExpense}
                disabled={isSubmitting}
                whileTap={{ scale: 0.97 }}
                className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                {isSubmitting ? (
                  'Saving...'
                ) : (
                  <>
                    <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Add Expense
                  </>
                )}
              </motion.button>

              <motion.button
                type="button"
                onClick={resetScanner}
                className="btn-ghost w-full py-3 text-sm flex items-center justify-center gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <svg width={18} height={18} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M20.016 4.356v4.992"
                  />
                </svg>
                Scan Another
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
