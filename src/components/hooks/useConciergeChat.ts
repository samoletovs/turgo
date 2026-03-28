'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { AgentIntent } from '@/types';
import { useUiStore } from '@/stores/useUiStore';
import { trpc } from '@/lib/trpc/client';

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
  intent?: AgentIntent;
}

export interface SuggestedAction {
  label: string;
  action: string;
  url?: string;
}

export const INTENT_ROUTES: Record<string, string> = {
  sell_start: '/sell',
  sell_upload: '/sell',
  sell_describe: '/sell',
  sell: '/sell',
  buy_start: '/buy',
  buy_describe: '/buy',
  buy: '/buy',
  browse: '/search',
  browse_categories: '/',
  browse_featured: '/',
  search: '/search',
  support_account: '/profile',
  support_billing: '/pricing',
  support_listing: '/profile',
};

// ─── Hook ────────────────────────────────────────────────

export function useConciergeChat({ locale = 'en' }: { locale?: string }) {
  const t = useTranslations('concierge');
  const router = useRouter();
  const { conciergeMinimized, setConciergeMinimized } = useUiStore();

  const [isOpen, setIsOpen] = useState(false);
  const isMinimized = conciergeMinimized;
  const setIsMinimized = setConciergeMinimized;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentIntent, setCurrentIntent] = useState<AgentIntent | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const conciergeMutation = trpc.ai.concierge.useMutation();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Add greeting on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          content: t('greeting'),
          timestamp: new Date(),
          actions: [
            { label: t('suggestions.0'), action: 'sell' },
            { label: t('suggestions.1'), action: 'buy' },
            { label: t('suggestions.2'), action: 'browse' },
          ],
        },
      ]);
    }
  }, [isOpen, messages.length, t]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const conversationHistory = messages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const data = await conciergeMutation.mutateAsync({
          message: content.trim(),
          conversationHistory,
        });

        const intent = data.intent as AgentIntent;

        if (intent && intent !== 'other') {
          setCurrentIntent(intent);
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          intent,
          actions: data.suggestedActions?.map(
            (a: { label: string; action: string; url?: string }) => ({
              label: a.label,
              action: a.action,
              url: a.url,
            }),
          ),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (isMinimized) {
          setUnreadCount((c) => c + 1);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: t('error') || "Sorry, I'm having trouble right now. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, isMinimized, t, conciergeMutation],
  );

  const handleActionClick = useCallback(
    (action: SuggestedAction) => {
      const route = INTENT_ROUTES[action.action];
      if (route) {
        router.push(`/${locale}${route}`);
        return;
      }
      if (action.url) {
        router.push(`/${locale}${action.url}`);
        return;
      }
      sendMessage(action.label);
    },
    [locale, router, sendMessage],
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
    setUnreadCount(0);
  }, [setIsMinimized]);

  const handleMinimize = useCallback(() => {
    setIsMinimized(true);
  }, [setIsMinimized]);

  const handleRestore = useCallback(() => {
    setIsMinimized(false);
    setUnreadCount(0);
  }, [setIsMinimized]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, [setIsMinimized]);

  return {
    // State
    isOpen,
    isMinimized,
    messages,
    input,
    isLoading,
    currentIntent,
    unreadCount,

    // Refs
    messagesEndRef,
    inputRef,

    // Actions
    setInput,
    setCurrentIntent,
    sendMessage,
    handleActionClick,
    handleOpen,
    handleMinimize,
    handleRestore,
    handleClose,

    // i18n
    t,
  };
}
