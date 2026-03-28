'use client';

import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Save,
  X,
  Globe,
} from 'lucide-react';

export default function LocationsPage() {
  const [parentFilter, _setParentFilter] = useState<string | undefined>();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    name: { en: '', lv: '', ru: '', lt: '', et: '' } as Record<string, string>,
    slug: '',
    type: 'COUNTRY' as 'COUNTRY' | 'REGION' | 'CITY' | 'DISTRICT',
    countryCode: '',
    parentId: undefined as string | undefined,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const {
    data: locations,
    refetch,
    isLoading,
  } = trpc.admin.locations.useQuery({
    parentId: parentFilter,
  });

  const createMutation = trpc.admin.createLocation.useMutation({
    onSuccess: () => {
      toast.success('Location created');
      refetch();
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.admin.updateLocation.useMutation({
    onSuccess: () => {
      toast.success('Location updated');
      refetch();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.admin.deleteLocation.useMutation({
    onSuccess: () => {
      toast.success('Location deleted');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const typeColors: Record<string, string> = {
    COUNTRY: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    REGION: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    CITY: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    DISTRICT: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Locations</h1>
          <p className="text-muted-foreground">
            Manage countries, regions, cities for Baltic expansion
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(true);
            setForm({
              name: { en: '', lv: '', ru: '', lt: '', et: '' },
              slug: '',
              type: 'COUNTRY',
              countryCode: '',
              parentId: undefined,
              latitude: undefined,
              longitude: undefined,
            });
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Location
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {['en', 'lv', 'ru', 'lt', 'et'].map((loc) => (
                <Input
                  key={loc}
                  placeholder={`Name (${loc.toUpperCase()})`}
                  value={form.name[loc] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: { ...form.name, [loc]: e.target.value },
                    })
                  }
                />
              ))}
              <Input
                placeholder="Slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}
              >
                <option value="COUNTRY">Country</option>
                <option value="REGION">Region</option>
                <option value="CITY">City</option>
                <option value="DISTRICT">District</option>
              </select>
              <Input
                placeholder="Country Code (e.g. LV)"
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
              />
              <Input
                placeholder="Latitude"
                type="number"
                step="any"
                value={form.latitude ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    latitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <Input
                placeholder="Longitude"
                type="number"
                step="any"
                value={form.longitude ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    longitude: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: form.name,
                    slug: form.slug,
                    type: form.type,
                    countryCode: form.countryCode || undefined,
                    parentId: form.parentId || undefined,
                    latitude: form.latitude,
                    longitude: form.longitude,
                  })
                }
                disabled={createMutation.isPending || !form.slug || !form.name.en}
              >
                <Save className="mr-1.5 h-4 w-4" /> Create
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                <X className="mr-1.5 h-4 w-4" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {locations?.map((loc) => (
                <div key={loc.id}>
                  <div className="flex items-center gap-3 p-4 hover:bg-muted/50">
                    {loc._count.children > 0 ? (
                      <button
                        onClick={() => toggleExpand(loc.id)}
                        className="text-muted-foreground"
                      >
                        {expandedIds.has(loc.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}

                    <Globe className="h-4 w-4 text-muted-foreground" />

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {(loc.name as Record<string, string>).en || loc.slug}
                        </span>
                        {loc.countryCode && <Badge variant="outline">{loc.countryCode}</Badge>}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[loc.type]}`}
                        >
                          {loc.type}
                        </span>
                      </div>
                    </div>

                    <Badge variant="secondary">{loc._count.listings} listings</Badge>
                    <Badge variant="outline">{loc._count.users} users</Badge>
                    <Badge variant="secondary">{loc._count.children} sub-locations</Badge>

                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(loc.id);
                          setForm({
                            name: loc.name as Record<string, string>,
                            slug: loc.slug,
                            type: loc.type as typeof form.type,
                            countryCode: loc.countryCode || '',
                            parentId: undefined,
                            latitude: loc.latitude ?? undefined,
                            longitude: loc.longitude ?? undefined,
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this location?'))
                            deleteMutation.mutate({ id: loc.id });
                        }}
                        disabled={loc._count.children > 0 || loc._count.listings > 0}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Children */}
                  {expandedIds.has(loc.id) &&
                    loc.children?.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 p-4 pl-16 bg-muted/20 hover:bg-muted/40"
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {(child.name as Record<string, string>).en || child.slug}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[child.type]}`}
                            >
                              {child.type}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline">{child._count.listings} listings</Badge>
                        <Badge variant="secondary">{child._count.children} sub</Badge>
                      </div>
                    ))}
                </div>
              ))}
              {locations?.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  No locations configured
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit modal inline */}
      {editingId && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Edit Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {['en', 'lv', 'ru', 'lt', 'et'].map((loc) => (
                <Input
                  key={loc}
                  placeholder={`Name (${loc.toUpperCase()})`}
                  value={form.name[loc] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: { ...form.name, [loc]: e.target.value },
                    })
                  }
                />
              ))}
              <Input
                placeholder="Slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <Input
                placeholder="Country Code"
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  updateMutation.mutate({
                    id: editingId,
                    name: form.name,
                    slug: form.slug,
                    countryCode: form.countryCode || undefined,
                  })
                }
                disabled={updateMutation.isPending}
              >
                <Save className="mr-1.5 h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
