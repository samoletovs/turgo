'use client';

import { useState } from 'react';
import { House, Search, Plus, MessageSquare, User, Tag, ShoppingBag, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Link, usePathname } from '@/i18n/navigation';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useSocket } from '@/lib/socket-client';

interface Tab {
  href: string;
  label: string;
  icon: typeof House;
  fab?: boolean;
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const [fabOpen, setFabOpen] = useState(false);
  const { unreadCount: socketUnreadCount, isConnected } = useSocket();

  const tabs: Tab[] = [
    { href: '/', label: t('home'), icon: House },
    { href: '/search', label: t('search'), icon: Search },
    { href: '#', label: t('new'), icon: Plus, fab: true },
    { href: '/messages', label: t('messages'), icon: MessageSquare },
    { href: '/profile', label: t('profile'), icon: User },
  ];

  // Polling fallback for when the socket is not connected
  const { data: polledUnreadCount } = trpc.message.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
    enabled: !!session && !isConnected,
  });

  // Real-time socket count takes priority; fall back to polling when offline
  const unreadCount = isConnected ? socketUnreadCount : (polledUnreadCount ?? 0);

  return (
    <>
      {/* FAB popover overlay */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[49] bg-black/40 md:hidden"
            onClick={() => setFabOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* FAB action sheet */}
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-20 left-1/2 z-[51] -translate-x-1/2 flex flex-col gap-2 md:hidden"
          >
            <Link
              href="/sell"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-primary-foreground shadow-lg"
            >
              <Tag className="h-5 w-5" />
              <span className="font-semibold">{t('sell')}</span>
            </Link>
            <Link
              href="/buy"
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-primary-foreground shadow-lg"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="font-semibold">{t('buy')}</span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={t('mobileNav')}
      >
        <ul className="mx-auto flex h-16 max-w-lg items-end justify-around px-2">
          {tabs.map((tab) => {
            const isActive =
              tab.href === '/'
                ? pathname === '/' || pathname === ''
                : pathname.startsWith(tab.href);

            const Icon = tab.icon;

            if (tab.fab) {
              return (
                <li key="fab" className="flex-1">
                  <button
                    onClick={() => setFabOpen((v) => !v)}
                    className="flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-primary-foreground"
                  >
                    <span
                      className={cn(
                        'flex h-11 w-11 -translate-y-2 items-center justify-center rounded-full shadow-lg ring-4 ring-background transition-transform',
                        fabOpen ? 'rotate-45 bg-muted-foreground' : 'bg-primary',
                      )}
                    >
                      {fabOpen ? (
                        <X className="h-5 w-5 text-background" />
                      ) : (
                        <Plus className="h-5 w-5 text-primary-foreground" />
                      )}
                    </span>
                    <span className="-mt-1">{fabOpen ? '' : t('new')}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />

                    {/* Unread badge on Messages tab */}
                    {tab.href === '/messages' &&
                      typeof unreadCount === 'number' &&
                      unreadCount > 0 && (
                        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                  </span>
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
