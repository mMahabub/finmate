'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeContext, useCurrencyContext } from './AppShell';
import { useAuth } from '@/context/AuthContext';
import { useSocketContext } from '@/context/SocketContext';
import { CURRENCIES } from '@/lib/constants';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/expenses': 'Expenses',
  '/expenses/add': 'Add Expense',
  '/scan': 'Scan Receipt',
  '/bills': 'Bills',
  '/budget': 'Budget',
  '/statistics': 'Statistics',
  '/analytics': 'Analytics',
  '/friends': 'Friends',
  '/chat': 'Chat',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/expenses/')) return 'Expense Details';
  if (pathname.startsWith('/chat/')) return 'Chat';
  return 'FinMate';
}

export function TopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggle } = useThemeContext();
  const { currency } = useCurrencyContext();
  const { user, logout } = useAuth();
  const { unreadNotifCount } = useSocketContext();
  const currencyInfo = CURRENCIES[currency] || CURRENCIES.USD;
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageTitle = getPageTitle(pathname);

  // Update browser tab title
  useEffect(() => {
    document.title = pageTitle === 'FinMate' ? 'FinMate - Your Financial Companion' : `${pageTitle} | FinMate`;
  }, [pageTitle]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16"
      style={{
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--card-border)',
      }}
    >
      {/* Left: Page title */}
      <h1
        className="text-xl font-heading font-bold truncate"
        style={{ color: 'var(--text-primary)' }}
      >
        {pageTitle}
      </h1>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          className="p-2 rounded-xl transition-all duration-200 hover:opacity-80"
          style={{ color: 'var(--text-secondary)' }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <motion.div
            animate={{ rotate: isDark ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isDark ? (
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </motion.div>
        </button>

        {/* Currency indicator */}
        <Link
          href="/settings"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:opacity-80"
          style={{
            color: 'var(--text-secondary)',
            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          }}
          title="Currency — click to change in Settings"
        >
          <span style={{ fontSize: 14 }}>{currencyInfo.symbol}</span>
          <span>{currencyInfo.code}</span>
        </Link>

        {/* Notification bell */}
        <Link
          href="/notifications"
          className="relative p-2 rounded-xl transition-all duration-200 hover:opacity-80"
          style={{ color: pathname === '/notifications' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
          title="Notifications"
        >
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          {unreadNotifCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 badge-pulse flex items-center justify-center text-white rounded-full"
              style={{
                minWidth: 18,
                height: 18,
                padding: '0 5px',
                fontSize: 10,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #ef4444, #f97316)',
              }}
            >
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </Link>

        {/* User avatar dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1.5 rounded-xl transition-all duration-200 hover:opacity-80"
              style={{
                background: showDropdown
                  ? isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                  : 'transparent',
              }}
            >
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="rounded-full object-cover"
                  style={{ width: 32, height: 32 }}
                />
              ) : (
                <div
                  className="rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    color: 'white',
                  }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <svg
                width={12}
                height={12}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="var(--text-muted)"
                className="hidden sm:block"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 rounded-2xl shadow-2xl overflow-hidden"
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                  }}
                >
                  {/* User info */}
                  <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="rounded-full object-cover"
                          style={{ width: 40, height: 40 }}
                        />
                      ) : (
                        <div
                          className="rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                          style={{
                            width: 40,
                            height: 40,
                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                            color: 'white',
                          }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {user.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <button
                      onClick={() => { setShowDropdown(false); router.push('/settings'); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors hover:opacity-80"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button>
                    <button
                      onClick={() => { setShowDropdown(false); logout(); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors hover:opacity-80"
                      style={{ color: '#ef4444' }}
                    >
                      <svg width={16} height={16} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      Log Out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}
