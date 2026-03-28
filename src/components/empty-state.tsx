'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Heart, MessageSquare, Package, Bot, Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptyStateType = 'favorites' | 'messages' | 'listings' | 'agents' | 'search' | 'notifications';

const ICONS: Record<EmptyStateType, React.ElementType> = {
  favorites: Heart,
  messages: MessageSquare,
  listings: Package,
  agents: Bot,
  search: Search,
  notifications: Bell,
};

const CTA_LINKS: Record<EmptyStateType, string> = {
  favorites: '/search',
  messages: '/search',
  listings: '/sell',
  agents: '/sell',
  search: '/search',
  notifications: '/search',
};

interface EmptyStateProps {
  type: EmptyStateType;
  onAction?: () => void;
}

export function EmptyState({ type, onAction }: EmptyStateProps) {
  const t = useTranslations('empty');
  const Icon = ICONS[type];
  const link = CTA_LINKS[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{t(`${type}.title`)}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{t(`${type}.description`)}</p>
      {onAction ? (
        <Button onClick={onAction}>{t(`${type}.cta`)}</Button>
      ) : (
        <Button asChild>
          <Link href={link}>{t(`${type}.cta`)}</Link>
        </Button>
      )}
    </div>
  );
}
