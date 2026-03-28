'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  Plus,
  Eye,
  MessageSquare,
  Bot,
  Pencil,
  Trash2,
  Zap,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Filter,
} from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPrice } from '@/lib/utils';

type ListingStatus = 'DRAFT' | 'ACTIVE' | 'SOLD' | 'EXPIRED' | 'MODERATION' | 'REJECTED';

const STATUS_CONFIG: Record<ListingStatus, { color: string; bgColor: string; dotColor: string }> = {
  ACTIVE: {
    color: 'text-green-700 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
  },
  SOLD: {
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
  },
  EXPIRED: {
    color: 'text-orange-700 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
  },
  DRAFT: {
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
  },
  MODERATION: {
    color: 'text-yellow-700 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
  },
  REJECTED: {
    color: 'text-red-700 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
  },
};

const STATUSES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'MODERATION', label: 'In Moderation' },
];

interface MyListingsClientProps {
  locale: string;
}

export function MyListingsClient({ locale }: MyListingsClientProps) {
  const t = useTranslations('myListings');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const queryInput = {
    status: statusFilter === 'ALL' ? undefined : (statusFilter as ListingStatus),
    page,
    limit: 20,
  };

  const { data, isLoading, refetch } = trpc.listing.myListings.useQuery(queryInput);
  const deleteMutation = trpc.listing.delete.useMutation({
    onSuccess: () => {
      setDeleteId(null);
      refetch();
    },
  });

  const listings = data?.listings ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link href="/listing/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t('createNew')}
          </Button>
        </Link>
      </div>

      {/* Toolbar: filter + view toggle */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={t('filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.total} {t('listingsCount')}
            </span>
          )}
        </div>

        <div className="flex gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`rounded-md p-1.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && listings.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t('empty')}</h3>
            <p className="mb-4 text-sm text-muted-foreground">{t('emptyDesc')}</p>
            <Link href="/listing/new">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                {t('createFirst')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Grid view */}
      {!isLoading && listings.length > 0 && viewMode === 'grid' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => {
            const status = listing.status as ListingStatus;
            const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
            const primaryImage = listing.images?.[0];
            const imageUrl = primaryImage?.url || '/placeholder.svg';

            return (
              <Card key={listing.id} className="group overflow-hidden">
                {/* Image */}
                <Link href={`/listing/${listing.slug}`}>
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={imageUrl}
                      alt={listing.title}
                      fill
                      unoptimized={imageUrl.startsWith('http')}
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,25vw"
                    />
                    {/* Status badge */}
                    <div className="absolute left-2 top-2">
                      <Badge className={`${config.bgColor} ${config.color} border text-[10px]`}>
                        <span
                          className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${config.dotColor}`}
                        />
                        {status}
                      </Badge>
                    </div>
                    {/* Agent badge */}
                    {listing.sellingAgent && (
                      <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <Bot className="h-3 w-3" /> AI
                        </Badge>
                      </div>
                    )}
                  </div>
                </Link>

                <CardContent className="p-3">
                  <Link href={`/listing/${listing.slug}`}>
                    <h3 className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
                      {listing.title}
                    </h3>
                  </Link>
                  <p
                    className="mt-1 text-lg font-bold text-primary"
                    style={{ fontFeatureSettings: '"tnum" 1' }}
                  >
                    {formatPrice(listing.price, listing.currency)}
                  </p>

                  {/* Stats row */}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {listing.viewCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {listing._count?.messages ?? 0}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-1.5">
                    <Link href={`/listing/${listing.slug}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1 text-xs">
                        <Pencil className="h-3 w-3" />
                        {t('edit')}
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setDeleteId(listing.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {status === 'ACTIVE' && (
                      <Link href="/pricing">
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Zap className="h-3 w-3" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* List view */}
      {!isLoading && listings.length > 0 && viewMode === 'list' && (
        <div className="space-y-2">
          {listings.map((listing) => {
            const status = listing.status as ListingStatus;
            const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
            const primaryImage = listing.images?.[0];
            const imageUrl = primaryImage?.url || '/placeholder.svg';

            return (
              <Card key={listing.id} className="group">
                <CardContent className="flex items-center gap-4 p-3">
                  {/* Thumbnail */}
                  <Link href={`/listing/${listing.slug}`}>
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={imageUrl}
                        alt={listing.title}
                        fill
                        unoptimized={imageUrl.startsWith('http')}
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/listing/${listing.slug}`}>
                        <h3 className="truncate text-sm font-medium hover:text-primary">
                          {listing.title}
                        </h3>
                      </Link>
                      <Badge
                        className={`${config.bgColor} ${config.color} border text-[10px] shrink-0`}
                      >
                        <span
                          className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${config.dotColor}`}
                        />
                        {status}
                      </Badge>
                      {listing.sellingAgent && (
                        <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                          <Bot className="h-3 w-3" /> AI
                        </Badge>
                      )}
                    </div>
                    <p
                      className="text-sm font-bold text-primary"
                      style={{ fontFeatureSettings: '"tnum" 1' }}
                    >
                      {formatPrice(listing.price, listing.currency)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {listing.viewCount ?? 0} {t('views')}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> {listing._count?.messages ?? 0}{' '}
                        {t('messages')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="hidden sm:flex gap-1.5 shrink-0">
                    <Link href={`/listing/${listing.slug}/edit`}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <Pencil className="h-3 w-3" /> {t('edit')}
                      </Button>
                    </Link>
                    {status === 'ACTIVE' && (
                      <Link href="/pricing">
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <Zap className="h-3 w-3" /> {t('boost')}
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs text-red-500 hover:text-red-600"
                      onClick={() => setDeleteId(listing.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('prev')}
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>{t('deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteId) deleteMutation.mutate({ id: deleteId });
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {t('confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
