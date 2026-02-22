"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Ban,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Unlock,
} from "lucide-react";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "USER" | "MODERATOR" | "ADMIN" | undefined
  >();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banDays, setBanDays] = useState("");

  const { data, refetch, isLoading } = trpc.admin.users.useQuery({
    search: search || undefined,
    role: roleFilter,
    page,
    limit: 20,
  });

  const warnMutation = trpc.admin.warnUser.useMutation({
    onSuccess: () => {
      toast.success("Warning issued");
      setWarnReason("");
      setSelectedUserId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const banMutation = trpc.admin.banUser.useMutation({
    onSuccess: () => {
      toast.success("User banned");
      setBanReason("");
      setBanDays("");
      setSelectedUserId(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const unbanMutation = trpc.admin.unbanUser.useMutation({
    onSuccess: () => {
      toast.success("User unbanned");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Search, warn, and ban users</p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput);
            setPage(1);
          }}
        >
          <Input
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-64"
          />
          <Button type="submit" size="sm">
            <Search className="mr-1.5 h-4 w-4" /> Search
          </Button>
        </form>
        <div className="flex gap-1">
          {[undefined, "USER", "MODERATOR", "ADMIN"].map((r) => (
            <Button
              key={r || "all"}
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setRoleFilter(r as typeof roleFilter);
                setPage(1);
              }}
            >
              {r || "All"}
            </Button>
          ))}
        </div>
        {data && (
          <Badge variant="secondary" className="ml-auto">
            {data.total} users
          </Badge>
        )}
      </div>

      {/* User List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">User</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Listings
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {user.name?.charAt(0)?.toUpperCase() ||
                              user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium">{user.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            user.role === "ADMIN"
                              ? "default"
                              : user.role === "MODERATOR"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{user._count.listings}</td>
                      <td className="px-4 py-3">
                        {user.isBanned ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : user._count.warnings > 0 ? (
                          <Badge variant="default">
                            {user._count.warnings} warning
                            {user._count.warnings !== 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          {user.isBanned ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                unbanMutation.mutate({ userId: user.id })
                              }
                              disabled={unbanMutation.isPending}
                            >
                              <Unlock className="mr-1 h-3.5 w-3.5" /> Unban
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setWarnReason("");
                                  setBanReason("");
                                }}
                              >
                                <AlertTriangle className="mr-1 h-3.5 w-3.5" />{" "}
                                Warn
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedUserId(user.id);
                                  setBanReason("");
                                  setBanDays("");
                                }}
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" /> Ban
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Dialog (inline) */}
      {selectedUserId && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-lg">User Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Issue Warning</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Reason for warning..."
                  value={warnReason}
                  onChange={(e) => setWarnReason(e.target.value)}
                />
                <Button
                  onClick={() =>
                    warnMutation.mutate({
                      userId: selectedUserId,
                      reason: warnReason,
                    })
                  }
                  disabled={!warnReason || warnMutation.isPending}
                >
                  <AlertTriangle className="mr-1.5 h-4 w-4" /> Warn
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Ban User</label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="Reason for ban..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Days (blank=permanent)"
                  value={banDays}
                  onChange={(e) => setBanDays(e.target.value)}
                  className="w-36"
                  type="number"
                />
                <Button
                  variant="destructive"
                  onClick={() =>
                    banMutation.mutate({
                      userId: selectedUserId,
                      reason: banReason,
                      durationDays: banDays ? parseInt(banDays) : undefined,
                    })
                  }
                  disabled={!banReason || banMutation.isPending}
                >
                  <Ban className="mr-1.5 h-4 w-4" /> Ban
                </Button>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSelectedUserId(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
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
