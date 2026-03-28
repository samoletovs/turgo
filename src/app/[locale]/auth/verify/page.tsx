'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { toast } from 'sonner';

type VerifyStatus = 'loading' | 'success' | 'expired' | 'invalid' | 'error' | 'pending';

export default function VerifyPage() {
  const t = useTranslations('verifyEmail');
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status');
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  const [status, _setStatus] = useState<VerifyStatus>(() => {
    // If redirected from the API route with a status param
    if (statusParam === 'success') return 'success';
    if (statusParam === 'expired') return 'expired';
    if (statusParam === 'invalid') return 'invalid';
    if (statusParam === 'error') return 'error';
    // If there's a token, the API route will handle verification via redirect
    if (token) return 'loading';
    // No token or status — user was sent here after registration
    return 'pending';
  });

  const [resending, setResending] = useState(false);

  // If token is present but no status, redirect to the API verify endpoint
  useEffect(() => {
    if (token && !statusParam) {
      window.location.href = `/api/auth/verify?token=${encodeURIComponent(token)}`;
    }
  }, [token, statusParam]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch('/api/auth/verify/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        toast.success(t('resent'));
      } else {
        toast.error(t('resent'));
      }
    } catch {
      toast.error(t('resent'));
    } finally {
      setResending(false);
    }
  };

  // Loading / redirecting to API
  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (status === 'success') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">{t('success')}</h1>
            <p className="mb-6 text-muted-foreground">{t('successDesc')}</p>
            <Button asChild size="lg">
              <Link href="/dashboard">{t('continue')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (status === 'expired') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">{t('expired')}</h1>
            <p className="mb-6 text-muted-foreground">{t('check')}</p>
            <Button variant="outline" asChild>
              <Link href="/auth/signin">{t('continue')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid or error
  if (status === 'invalid' || status === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">
              {status === 'invalid' ? t('expired') : t('title')}
            </h1>
            <p className="mb-6 text-muted-foreground">{t('check')}</p>
            <Button variant="outline" asChild>
              <Link href="/auth/signin">{t('continue')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pending — user just registered, no token in URL
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
          {email && (
            <p className="mb-2 text-sm">
              {t('sent')} <strong className="text-foreground">{email}</strong>
            </p>
          )}
          <p className="mb-6 text-sm text-muted-foreground">{t('check')}</p>
          {email && (
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resending}
              className="w-full"
            >
              {resending ? '...' : t('resend')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
