import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MessageCircle, User, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

interface MessagesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MessagesPage({ params }: MessagesPageProps) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/signin`);
  }

  const conversations = await db.conversation.findMany({
    where: {
      OR: [
        { buyerId: session.user.id },
        { sellerId: session.user.id },
      ],
    },
    orderBy: { lastMessageAt: "desc" },
    include: {
      buyer: {
        select: { id: true, name: true, avatar: true },
      },
      seller: {
        select: { id: true, name: true, avatar: true },
      },
      listing: {
        select: { id: true, title: true, slug: true, price: true, currency: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, createdAt: true, senderId: true, isRead: true },
      },
    },
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Messages</h1>

      {conversations.length === 0 ? (
        <div className="py-20 text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No messages yet</h3>
          <p className="text-muted-foreground">
            When you contact a seller or receive a message, it will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv: typeof conversations[number]) => {
            const otherUser = conv.buyerId === session.user!.id ? conv.seller : conv.buyer;
            const lastMessage = conv.messages[0];
            const isUnread =
              lastMessage &&
              !lastMessage.isRead &&
              lastMessage.senderId !== session.user!.id;

            return (
              <Link
                key={conv.id}
                href={`/${locale}/messages/${conv.id}`}
                className="block"
              >
                <Card
                  className={`transition-colors hover:bg-muted/50 ${
                    isUnread ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    {/* Avatar */}
                    {otherUser?.avatar ? (
                      <Image
                        src={otherUser.avatar}
                        alt={otherUser.name || "User"}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`font-medium ${isUnread ? "font-bold" : ""}`}>
                          {otherUser?.name || "User"}
                        </p>
                        {lastMessage && (
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      {conv.listing && (
                        <p className="text-xs text-muted-foreground">
                          Re: {conv.listing.title}
                        </p>
                      )}
                      {lastMessage && (
                        <p
                          className={`mt-1 truncate text-sm ${
                            isUnread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {lastMessage.senderId === session.user!.id && "You: "}
                          {lastMessage.content}
                        </p>
                      )}
                    </div>

                    {/* Unread indicator */}
                    {isUnread && (
                      <div className="h-3 w-3 rounded-full bg-primary" />
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
