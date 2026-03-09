'use client';

import { createContext, useContext } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { MobileNav } from './MobileNav';
import { ToastProvider } from '@/components/ui/ToastContainer';
import { useTheme } from '@/hooks/useTheme';
import { useCurrency } from '@/hooks/useCurrency';
import { useGamification } from '@/hooks/useGamification';
import { QuickAddFAB } from '@/components/ui/QuickAddFAB';
import { CelebrationPopup } from '@/components/ui/CelebrationPopup';
import { CurrencyCode } from '@/types/expense';

interface ThemeContextType {
  isDark: boolean;
  toggle: () => void;
}

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
}

interface GamificationContextType {
  checkGamification: (action?: string) => Promise<unknown>;
}

export const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggle: () => {},
});

export const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'USD',
  setCurrency: () => {},
});

export const GamificationContext = createContext<GamificationContextType>({
  checkGamification: async () => null,
});

export function useThemeContext() {
  return useContext(ThemeContext);
}

export function useCurrencyContext() {
  return useContext(CurrencyContext);
}

export function useGamificationContext() {
  return useContext(GamificationContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const currencyState = useCurrency();
  const { checkGamification, celebration, dismissCelebration } = useGamification();

  return (
    <ThemeContext.Provider value={theme}>
      <CurrencyContext.Provider value={currencyState}>
        <GamificationContext.Provider value={{ checkGamification }}>
          <ToastProvider>
            <div
              className="min-h-screen flex transition-colors duration-300"
              style={{ background: 'var(--background)' }}
            >
              <Sidebar />
              <div className="flex-1 md:ml-72 flex flex-col min-h-screen">
                <TopHeader />
                <main className="flex-1 pb-24 md:pb-0">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                    {children}
                  </div>
                </main>
              </div>
              <MobileNav />
              <QuickAddFAB />
            </div>
            <CelebrationPopup celebration={celebration} onDismiss={dismissCelebration} />
          </ToastProvider>
        </GamificationContext.Provider>
      </CurrencyContext.Provider>
    </ThemeContext.Provider>
  );
}
