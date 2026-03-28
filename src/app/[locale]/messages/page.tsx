import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { MessagesPageClient } from './messages-client';

interface MessagesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  return <MessagesPageClient locale={locale} />;
}
