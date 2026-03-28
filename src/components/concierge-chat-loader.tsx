'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

interface ConciergeChatProps {
  locale?: string;
}

const ConciergeChat = dynamic<ConciergeChatProps>(
  () =>
    import('@/components/concierge-chat').then(
      (mod) => mod.ConciergeChat as ComponentType<ConciergeChatProps>,
    ),
  { ssr: false },
);

export function ConciergeChatLoader({ locale }: { locale: string }) {
  return <ConciergeChat locale={locale} />;
}
