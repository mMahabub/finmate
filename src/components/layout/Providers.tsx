'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/chat/CallOverlay';
import { AppShell } from './AppShell';
import { SplashScreen } from '@/components/ui/SplashScreen';

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password'];

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (loading && !isAuthPage) {
    return <SplashScreen />;
  }

  return (
    <SocketProvider>
      <CallProvider>
        {isAuthPage ? children : <AppShell>{children}</AppShell>}
        <CallOverlay />
      </CallProvider>
    </SocketProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
}
