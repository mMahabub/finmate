'use client';

interface FinMateLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { icon: 28, text: 'text-sm', gap: 'gap-2' },
  md: { icon: 40, text: 'text-lg', gap: 'gap-3' },
  lg: { icon: 56, text: 'text-2xl', gap: 'gap-3' },
  xl: { icon: 72, text: 'text-3xl', gap: 'gap-4' },
};

export function FinMateIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="finmate-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
        <linearGradient id="finmate-shine" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.25" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="48" height="48" rx="12" fill="url(#finmate-bg)" />
      <rect width="48" height="48" rx="12" fill="url(#finmate-shine)" />
      {/* Wallet body */}
      <rect x="10" y="16" width="28" height="20" rx="3" stroke="white" strokeWidth="2.2" fill="none" />
      {/* Wallet flap */}
      <path d="M10 19C10 15.134 13.134 12 17 12H31C34.866 12 38 15.134 38 19" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {/* Dollar sign */}
      <path d="M24 21v6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M21.5 23.2c0-0.9 0.7-1.6 2.5-1.6s2.5 0.7 2.5 1.6c0 1.2-2.5 1.2-2.5 2.4 0 0.9 0.7 1.6 2.5 1.6s2.5-0.7 2.5-1.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Connection dots (mate/companion symbol) */}
      <circle cx="33" cy="26" r="1.8" fill="white" opacity="0.9" />
      <circle cx="37" cy="26" r="1" fill="white" opacity="0.5" />
    </svg>
  );
}

export function FinMateLogo({ size = 'md', showText = true, className = '' }: FinMateLogoProps) {
  const s = SIZES[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <div className="flex-shrink-0" style={{ filter: 'drop-shadow(0 4px 12px rgba(99, 102, 241, 0.3))' }}>
        <FinMateIcon size={s.icon} />
      </div>
      {showText && (
        <div>
          <h1 className={`font-heading font-bold ${s.text} leading-tight`} style={{ color: 'var(--text-primary)' }}>
            FinMate
          </h1>
          {(size === 'lg' || size === 'xl') && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Your Financial Companion
            </p>
          )}
          {size === 'md' && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Your Financial Companion
            </p>
          )}
        </div>
      )}
    </div>
  );
}
