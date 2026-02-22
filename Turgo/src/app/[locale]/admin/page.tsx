import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Users,
  ShoppingBag,
  Shield,
  Flag,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";

export default async function AdminOverviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/auth/signin`);

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    totalUsers,
    totalListings,
    activeListings,
    pendingModeration,
    openReports,
    pendingEscalations,
    newUsersLast30,
    activeSubscriptions,
  ] = await Promise.all([
    db.user.count(),
    db.listing.count(),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.listing.count({ where: { status: "MODERATION" } }),
    db.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    db.escalationItem.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  const stats = [
    {
      title: "Total Users",
      value: totalUsers,
      sub: `+${newUsersLast30} last 30d`,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Active Listings",
      value: activeListings,
      sub: `${totalListings} total`,
      icon: ShoppingBag,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Pending Moderation",
      value: pendingModeration,
      sub: "Awaiting review",
      icon: Shield,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950",
      href: `/${locale}/admin/moderation`,
    },
    {
      title: "Open Reports",
      value: openReports,
      sub: "Need attention",
      icon: Flag,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-950",
      href: `/${locale}/admin/reports`,
    },
    {
      title: "Escalations",
      value: pendingEscalations,
      sub: "Agent-flagged items",
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950",
      href: `/${locale}/admin/escalations`,
    },
    {
      title: "Active Subscriptions",
      value: activeSubscriptions,
      sub: "Paid users",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950",
      href: `/${locale}/admin/revenue`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview and quick actions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const content = (
            <Card
              key={stat.title}
              className={stat.href ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                  </div>
                  <div className={`rounded-lg p-3 ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return stat.href ? (
            <Link key={stat.title} href={stat.href}>
              {content}
            </Link>
          ) : (
            <div key={stat.title}>{content}</div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Review Moderation Queue", href: `/${locale}/admin/moderation`, badge: pendingModeration },
              { label: "Manage Categories", href: `/${locale}/admin/categories` },
              { label: "User Management", href: `/${locale}/admin/users` },
              { label: "Revenue Dashboard", href: `/${locale}/admin/revenue` },
              { label: "Analytics", href: `/${locale}/admin/analytics` },
              { label: "Agent Monitoring", href: `/${locale}/admin/agents` },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium">{action.label}</span>
                {action.badge ? (
                  <Badge variant={action.badge > 0 ? "destructive" : "secondary"}>
                    {action.badge}
                  </Badge>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Moderation Queue</span>
              <Badge variant={pendingModeration > 10 ? "destructive" : pendingModeration > 0 ? "default" : "success"}>
                {pendingModeration === 0 ? "Clear" : `${pendingModeration} pending`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Open Reports</span>
              <Badge variant={openReports > 5 ? "destructive" : openReports > 0 ? "default" : "success"}>
                {openReports === 0 ? "Clear" : `${openReports} open`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Escalations</span>
              <Badge variant={pendingEscalations > 3 ? "destructive" : pendingEscalations > 0 ? "default" : "success"}>
                {pendingEscalations === 0 ? "Clear" : `${pendingEscalations} pending`}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">User Growth (30d)</span>
              <Badge variant="secondary">+{newUsersLast30}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
