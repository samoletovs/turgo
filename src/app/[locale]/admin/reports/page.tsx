'use client';

import { trpc } from '@/lib/trpc/client';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ReportsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<
    'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED' | undefined
  >('OPEN');
  const [resolveNote, setResolveNote] = useState('');

  const { data, refetch, isLoading } = trpc.admin.reports.useQuery({
    status: statusFilter,
    page,
    limit: 20,
  });

  const resolveMutation = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      toast.success('Report resolved');
      setResolveNote('');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const statusColors: Record<
    string,
    'default' | 'secondary' | 'destructive' | 'success' | 'outline'
  > = {
    OPEN: 'destructive',
    REVIEWING: 'default',
    RESOLVED: 'success',
    DISMISSED: 'secondary',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Flagged listings reported by users</p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {s}
          </Button>
        ))}
        <Button
          variant={!statusFilter ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setStatusFilter(undefined);
            setPage(1);
          }}
        >
          All
        </Button>
        {data && (
          <Badge variant="secondary" className="ml-auto">
            {data.total} total
          </Badge>
        )}
      </div>

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.reports.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No reports found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data?.reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {report.listing.images?.[0] && (
                    <Image
                      src={report.listing.images[0].url}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{report.listing.title}</h3>
                      <Badge variant={statusColors[report.status]}>{report.status}</Badge>
                      <Badge variant="outline">{report.reason}</Badge>
                    </div>
                    {report.details && (
                      <p className="text-sm text-muted-foreground mt-1">{report.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Reported {new Date(report.createdAt).toLocaleDateString()}
                      {report.reviewNote && ` — Note: ${report.reviewNote}`}
                    </p>
                  </div>

                  {(report.status === 'OPEN' || report.status === 'REVIEWING') && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() =>
                            resolveMutation.mutate({
                              reportId: report.id,
                              action: 'RESOLVED',
                              note: resolveNote || undefined,
                            })
                          }
                          disabled={resolveMutation.isPending}
                        >
                          <CheckCircle className="mr-1 h-3.5 w-3.5" /> Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            resolveMutation.mutate({
                              reportId: report.id,
                              action: 'DISMISSED',
                              note: resolveNote || undefined,
                            })
                          }
                          disabled={resolveMutation.isPending}
                        >
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
