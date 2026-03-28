'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { ThemeProvider } from 'next-themes';
import { TRPCProvider } from '@/lib/trpc/client';
import { SocketProvider } from '@/lib/socket-client';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
}

/** Only mount SocketProvider when the user is authenticated */
function ConditionalSocket({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  if (status === 'authenticated') {
    return <SocketProvider>{children}</SocketProvider>;
  }
  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <TRPCProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConditionalSocket>{children}</ConditionalSocket>
          <Toaster position="bottom-right" richColors closeButton duration={4000} />
        </ThemeProvider>
      </TRPCProvider>
    </SessionProvider>
  );
}
