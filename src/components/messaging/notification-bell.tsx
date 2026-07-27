'use client';

import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/lib/socket-client';
import { Link } from '@/i18n/navigation';

interface NotificationBellProps {
  /** Extra CSS classes applied to the button wrapper */
  className?: string;
  /** Icon size class, e.g. "h-4 w-4" (default) */
  iconSize?: string;
}

/**
 * Messages icon button with a real-time unread-count badge.
 * Uses the SocketProvider context — must be rendered inside <SocketProvider>.
 */
export function NotificationBell({ className, iconSize = 'h-4 w-4' }: NotificationBellProps) {
  const { unreadCount } = useSocket();

  return (
    <Button variant="ghost" size="icon" className={className} asChild>
      <Link href="/messages" aria-label={unreadCount > 0 ? `Messages (${unreadCount} unread)` : 'Messages'}>
        <span className="relative">
          <MessageSquare className={iconSize} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </span>
      </Link>
    </Button>
  );
}
