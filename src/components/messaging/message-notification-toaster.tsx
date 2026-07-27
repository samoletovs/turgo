'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { MessageSquare } from 'lucide-react';
import { useSocket, type MessageNotification } from '@/lib/socket-client';
import { useSession } from 'next-auth/react';
import { Link } from '@/i18n/navigation';

/**
 * Listens for incoming `message:notification` socket events and surfaces them
 * as non-intrusive toast notifications.  Mount this component once inside the
 * SocketProvider (e.g. in Providers) so it is active for the whole session.
 */
export function MessageNotificationToaster() {
  const { socket } = useSocket();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Keep a ref to the latest userId so the handler closure never stales
  const userIdRef = useRef<string | undefined>(currentUserId);
  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageNotification = (notification: MessageNotification) => {
      // Never show a toast for own messages
      if (notification.senderId === userIdRef.current) return;

      const prefix = notification.isAgentMessage ? '🤖 ' : '';
      const preview =
        notification.preview.length > 60
          ? `${notification.preview.slice(0, 60)}…`
          : notification.preview;

      toast.custom(
        (id) => (
          <Link
            href={`/messages/${notification.conversationId}`}
            className="flex w-full max-w-sm items-start gap-3 rounded-lg border bg-background p-4 shadow-lg transition-opacity hover:opacity-90"
            onClick={() => toast.dismiss(id)}
          >
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold leading-none">
                {prefix}New message
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{preview}</p>
            </div>
          </Link>
        ),
        {
          duration: 5000,
          position: 'bottom-right',
        },
      );
    };

    socket.on('message:notification', handleMessageNotification);
    return () => {
      socket.off('message:notification', handleMessageNotification);
    };
  }, [socket]);

  // This component renders nothing visible — it only registers a side-effect
  return null;
}
