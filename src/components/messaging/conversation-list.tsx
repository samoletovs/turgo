'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { MessageCircle, User, Bot, Search } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc/client';
import { useState, useMemo } from 'react';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface ConversationListProps {
  locale?: string;
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function ConversationList({
  locale = 'en',
  activeConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const userId = session?.user?.id;

  const [searchQuery, setSearchQuery] = useState('');

  const conversationsQuery = trpc.message.myConversations.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30s
  });

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((conv) => {
      const otherUser = conv.buyerId === userId ? conv.seller : conv.buyer;
      return (
        otherUser?.name?.toLowerCase().includes(q) || conv.listing?.title?.toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery, userId]);

  const handleSelect = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    } else {
      router.push(`/${locale}/messages/${conversationId}`);
    }
  };

  if (conversationsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-full text-sm"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="py-12 text-center px-4">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? 'No matching conversations' : 'No messages yet'}
            </p>
            {!searchQuery && (
              <p className="text-xs text-muted-foreground mt-1">
                Start a conversation by messaging a seller
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => {
              const otherUser = conv.buyerId === userId ? conv.seller : conv.buyer;
              const lastMessage = conv.messages[0];
              const unreadCount = conv._count?.messages ?? 0;
              const isActive = conv.id === activeConversationId;
              const isUnread =
                lastMessage && !lastMessage.isRead && lastMessage.senderId !== userId;

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                    isActive && 'bg-muted',
                    isUnread && !isActive && 'bg-primary/5',
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {otherUser?.avatar ? (
                      <Image
                        src={otherUser.avatar}
                        alt={otherUser.name || 'User'}
                        width={44}
                        height={44}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    {/* Agent badge on avatar */}
                    {conv.listing?.managedByAgent && (
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn('text-sm truncate', isUnread ? 'font-bold' : 'font-medium')}
                      >
                        {otherUser?.name || 'User'}
                      </span>
                      {lastMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {formatRelativeTime(new Date(lastMessage.createdAt))}
                        </span>
                      )}
                    </div>

                    {/* Listing title */}
                    <p className="text-[11px] text-muted-foreground truncate">
                      {conv.listing?.title}
                    </p>

                    {/* Last message preview */}
                    {lastMessage && (
                      <div className="flex items-center gap-1 mt-0.5">
                        {lastMessage.isAgentMessage && <span className="text-[10px]">🤖</span>}
                        <p
                          className={cn(
                            'text-xs truncate',
                            isUnread ? 'font-medium text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {lastMessage.senderId === userId && 'You: '}
                          {lastMessage.messageType === 'OFFER'
                            ? '💰 Made an offer'
                            : lastMessage.messageType === 'COUNTER_OFFER'
                              ? '🔄 Counter-offer'
                              : lastMessage.messageType === 'ACCEPTANCE'
                                ? '✅ Offer accepted'
                                : lastMessage.messageType === 'REJECTION'
                                  ? '❌ Offer declined'
                                  : lastMessage.content}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Unread badge */}
                  {unreadCount > 0 && (
                    <Badge className="h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
