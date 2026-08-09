'use client';

import { cn, formatPrice } from '@/lib/utils';
import { Bot, Check, CheckCheck, Clock, Globe, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  MESSAGE_REACTIONS,
  parseMessageReactions,
  type MessageReactionEmoji,
} from '@/lib/message-reactions';

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface MessageBubbleProps {
  id: string;
  content: string;
  messageType: string;
  isOwn: boolean;
  isAgentMessage: boolean;
  senderName?: string;
  senderAvatar?: string;
  createdAt: Date | string;
  isRead?: boolean;
  metadata?: Record<string, unknown>;
  translatedContent?: Record<string, string>;
  originalLanguage?: string;
  requiresApproval?: boolean;
  approvedAt?: Date | string | null;
  locale?: string;
  onApprove?: (messageId: string, editedContent?: string) => void;
  onReject?: (messageId: string) => void;
  onTranslate?: (messageId: string, locale: string) => void;
  onReact?: (messageId: string, emoji: MessageReactionEmoji) => void;
  currentUserId?: string;
}

// ──────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────

export function MessageBubble({
  id,
  content,
  messageType,
  isOwn,
  isAgentMessage,
  senderName,
  createdAt,
  isRead,
  metadata,
  translatedContent,
  originalLanguage,
  requiresApproval,
  approvedAt,
  locale = 'en',
  onApprove,
  onReject,
  onTranslate,
  onReact,
  currentUserId,
}: MessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const time = new Date(createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const translation = translatedContent?.[locale];
  const displayContent = showTranslation && translation ? translation : content;
  const reactions = parseMessageReactions(metadata?.reactions);
  const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

  // Pending approval state — show as draft with edit/approve/reject
  const isPending = requiresApproval && !approvedAt;

  return (
    <div className={cn('flex gap-2 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Bubble */}
      <div className={cn('flex max-w-[75%] flex-col gap-1', isOwn && 'items-end')}>
        {/* Sender info */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium text-muted-foreground">
              {senderName ?? 'User'}
            </span>
            {isAgentMessage && (
              <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
                <Bot className="h-2.5 w-2.5" />
                🤖 Agent
              </Badge>
            )}
          </div>
        )}

        {/* Own agent message indicator */}
        {isOwn && isAgentMessage && (
          <div className="flex items-center gap-1.5 px-1">
            <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[10px]">
              <Bot className="h-2.5 w-2.5" />
              🤖 Sent by Agent
            </Badge>
          </div>
        )}

        {/* Message type header for offers/negotiations */}
        {messageType !== 'TEXT' && messageType !== 'AUTO_RESPONSE' && messageType !== 'SYSTEM' && (
          <MessageTypeHeader messageType={messageType} metadata={metadata} isOwn={isOwn} />
        )}

        {/* Pending approval banner */}
        {isPending && (
          <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Clock className="h-3 w-3" />
            Awaiting your approval
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
            isPending && 'rounded-t-none border border-t-0 border-amber-300 dark:border-amber-700',
            isOwn ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md',
            messageType === 'SYSTEM' &&
              'bg-transparent text-center text-xs text-muted-foreground italic border-0 px-0',
            messageType === 'OFFER' &&
              !isOwn &&
              'bg-blue-50 border border-blue-200 dark:bg-blue-950 dark:border-blue-800',
            messageType === 'COUNTER_OFFER' &&
              'bg-orange-50 border border-orange-200 dark:bg-orange-950 dark:border-orange-800',
            messageType === 'ACCEPTANCE' &&
              'bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800',
            messageType === 'REJECTION' &&
              'bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800',
          )}
        >
          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[60px] bg-transparent resize-none outline-none text-sm"
              autoFocus
            />
          ) : (
            displayContent
          )}
        </div>

        {/* Reactions */}
        {(reactionEntries.length > 0 || onReact) && (
          <div className={cn('flex flex-wrap items-center gap-1 px-1', isOwn && 'justify-end')}>
            {reactionEntries.map(([emoji, users]) => {
              const reactedByMe = !!currentUserId && users.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact?.(id, emoji)}
                  aria-label={`React with ${emoji}, ${users.length} reaction${users.length === 1 ? '' : 's'}`}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                    reactedByMe
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  {emoji} {users.length}
                </button>
              );
            })}

            {onReact && messageType !== 'SYSTEM' && (
              <div className="flex items-center gap-1">
                {MESSAGE_REACTIONS.map((emoji) => {
                  const reactedByMe = !!currentUserId && (reactions[emoji] ?? []).includes(currentUserId);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReact(id, emoji)}
                      className={cn(
                        'rounded-full border px-1.5 py-0.5 text-[11px] transition-colors',
                        reactedByMe
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-dashed hover:bg-muted',
                      )}
                      aria-label={reactedByMe ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom row: time, read status, actions */}
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground">{time}</span>

          {/* Read status */}
          {isOwn && (
            <span className="text-muted-foreground">
              {isRead ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}

          {/* Translation toggle */}
          {originalLanguage && originalLanguage !== locale && (
            <button
              onClick={() => {
                if (!translation && onTranslate) {
                  onTranslate(id, locale);
                }
                setShowTranslation(!showTranslation);
              }}
              className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Globe className="h-2.5 w-2.5" />
              {showTranslation ? 'Original' : 'Translate'}
            </button>
          )}

          {/* Approval actions */}
          {isPending && onApprove && onReject && (
            <div className="flex items-center gap-1 ml-auto">
              {!editing ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-red-500 hover:text-red-700"
                    onClick={() => onReject(id)}
                  >
                    Reject
                  </Button>
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={() => onApprove(id)}>
                    Send
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setEditing(false);
                      setEditContent(content);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      onApprove(id, editContent);
                      setEditing(false);
                    }}
                  >
                    Send Edited
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// MESSAGE TYPE HEADER
// ──────────────────────────────────────────────

function MessageTypeHeader({
  messageType,
  metadata,
  isOwn,
}: {
  messageType: string;
  metadata?: Record<string, unknown>;
  isOwn: boolean;
}) {
  const offerPrice = metadata?.offerPrice as number | undefined;
  const counterPrice = metadata?.counterPrice as number | undefined;

  const labels: Record<string, { icon: string; label: string; color: string }> = {
    OFFER: {
      icon: '💰',
      label: `Offer${offerPrice ? `: ${formatPrice(offerPrice)}` : ''}`,
      color: 'text-blue-600 dark:text-blue-400',
    },
    COUNTER_OFFER: {
      icon: '🔄',
      label: `Counter-offer${counterPrice ? `: ${formatPrice(counterPrice)}` : ''}`,
      color: 'text-orange-600 dark:text-orange-400',
    },
    ACCEPTANCE: {
      icon: '✅',
      label: 'Offer Accepted',
      color: 'text-green-600 dark:text-green-400',
    },
    REJECTION: {
      icon: '❌',
      label: 'Offer Declined',
      color: 'text-red-600 dark:text-red-400',
    },
  };

  const info = labels[messageType];
  if (!info) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1 text-xs font-semibold',
        info.color,
        isOwn && 'justify-end',
      )}
    >
      <span>{info.icon}</span>
      <span>{info.label}</span>
    </div>
  );
}
