import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/signin`);
  }

  // Verify admin/moderator role
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, name: true, email: true, avatar: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
    redirect(`/${locale}`);
  }

  return (
    <div className="flex h-screen bg-muted/30">
      <AdminSidebar
        locale={locale}
        user={{
          name: user.name || user.email,
          email: user.email,
          avatar: user.avatar ?? undefined,
          role: user.role,
        }}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
