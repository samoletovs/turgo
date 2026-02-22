"use client";

import { House, Search, Plus, MessageSquare, User } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  locale: string;
}

interface Tab {
  href: string;
  label: string;
  icon: typeof House;
  fab?: boolean;
}

const tabs: Tab[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/sell", label: "Sell", icon: Plus, fab: true },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav({ locale: _locale }: BottomNavProps) {
  const pathname = usePathname();

  // Lightweight tRPC query for unread message count
  const { data: unreadCount } = trpc.message.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Mobile navigation"
    >
      <ul className="mx-auto flex h-16 max-w-lg items-end justify-around px-2">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/" || pathname === ""
              : pathname.startsWith(tab.href);

          const Icon = tab.icon;

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  tab.fab
                    ? "text-primary-foreground"
                    : isActive
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.fab ? (
                  /* Elevated FAB-style button for Sell */
                  <span className="flex h-11 w-11 -translate-y-2 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-background">
                    <Icon className="h-5 w-5 text-primary-foreground" />
                  </span>
                ) : (
                  <span className="relative">
                    <Icon className="h-5 w-5" />

                    {/* Unread badge on Messages tab */}
                    {tab.label === "Messages" &&
                      typeof unreadCount === "number" &&
                      unreadCount > 0 && (
                        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                  </span>
                )}
                <span className={cn(tab.fab && "-mt-1")}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
