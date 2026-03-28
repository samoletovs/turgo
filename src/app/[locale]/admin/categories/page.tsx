'use client';

import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Save, X } from 'lucide-react';

interface CategoryFormData {
  name: Record<string, string>;
  slug: string;
  icon: string;
  description: string;
  parentId?: string | null;
}

export default function CategoriesPage() {
  const { data: categories, refetch, isLoading } = trpc.admin.categories.useQuery();
  const createMutation = trpc.admin.createCategory.useMutation({
    onSuccess: () => {
      toast.success('Category created');
      refetch();
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.admin.updateCategory.useMutation({
    onSuccess: () => {
      toast.success('Category updated');
      refetch();
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.admin.deleteCategory.useMutation({
    onSuccess: () => {
      toast.success('Category deleted');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const reorderMutation = trpc.admin.reorderCategories.useMutation({
    onSuccess: () => {
      toast.success('Order saved');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<CategoryFormData>({
    name: { en: '', lv: '', ru: '', lt: '', et: '' },
    slug: '',
    icon: '',
    description: '',
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

  const startEdit = (cat: {
    id: string;
    name: unknown;
    slug: string;
    icon: string | null;
    description: string | null;
  }) => {
    setEditingId(cat.id);
    setForm({
      name: cat.name as Record<string, string>,
      slug: cat.slug,
      icon: cat.icon || '',
      description: cat.description || '',
    });
  };

  const handleMoveUp = (index: number) => {
    if (!categories || index === 0) return;
    const items = categories.map((c, i) => ({
      id: c.id,
      sortOrder: i === index ? index - 1 : i === index - 1 ? index : i,
    }));
    reorderMutation.mutate(items);
  };

  const handleMoveDown = (index: number) => {
    if (!categories || index >= categories.length - 1) return;
    const items = categories.map((c, i) => ({
      id: c.id,
      sortOrder: i === index ? index + 1 : i === index + 1 ? index : i,
    }));
    reorderMutation.mutate(items);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage listing categories and hierarchy</p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(true);
            setForm({
              name: { en: '', lv: '', ru: '', lt: '', et: '' },
              slug: '',
              icon: '',
              description: '',
            });
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add Category
        </Button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
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
                placeholder="Slug (e.g. electronics)"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
              <Input
                placeholder="Icon (e.g. Laptop)"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  createMutation.mutate({
                    name: form.name,
                    slug: form.slug,
                    icon: form.icon || undefined,
                    description: form.description || undefined,
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

      {/* Category List */}
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
              {categories?.map((cat, index) => (
                <div key={cat.id}>
                  {/* Parent Category */}
                  <div className="flex items-center gap-3 p-4 hover:bg-muted/50">
                    <div className="flex flex-col gap-0.5">
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === (categories?.length ?? 0) - 1}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>

                    {cat._count.children > 0 ? (
                      <button
                        onClick={() => toggleExpand(cat.id)}
                        className="text-muted-foreground"
                      >
                        {expandedIds.has(cat.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}

                    {editingId === cat.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={form.name.en || ''}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              name: { ...form.name, en: e.target.value },
                            })
                          }
                          className="max-w-xs"
                        />
                        <Input
                          value={form.slug}
                          onChange={(e) => setForm({ ...form, slug: e.target.value })}
                          className="max-w-[180px]"
                        />
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({
                              id: cat.id,
                              name: form.name,
                              slug: form.slug,
                              icon: form.icon || undefined,
                            })
                          }
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {cat.icon && <span className="text-lg">{cat.icon}</span>}
                            <span className="font-medium">
                              {(cat.name as Record<string, string>).en || cat.slug}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {cat.slug}
                            </Badge>
                          </div>
                        </div>
                        <Badge variant="outline">{cat._count.listings} listings</Badge>
                        <Badge variant="secondary">{cat._count.children} sub</Badge>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => startEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm('Delete this category?'))
                                deleteMutation.mutate({ id: cat.id });
                            }}
                            disabled={cat._count.listings > 0 || cat._count.children > 0}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Children */}
                  {expandedIds.has(cat.id) &&
                    cat.children?.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center gap-3 p-4 pl-16 bg-muted/20 hover:bg-muted/40"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {(child.name as Record<string, string>).en || child.slug}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {child.slug}
                            </Badge>
                          </div>
                        </div>
                        <Badge variant="outline">{child._count.listings} listings</Badge>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
