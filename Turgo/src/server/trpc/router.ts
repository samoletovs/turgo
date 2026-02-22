import { createTRPCRouter } from "@/server/trpc";
import { listingRouter } from "./routers/listing";
import { categoryRouter } from "./routers/category";
import { userRouter } from "./routers/user";
import { agentRouter } from "./routers/agent";
import { favoriteRouter } from "./routers/favorite";
import { messageRouter } from "./routers/message";
import { searchRouter } from "./routers/search";
import { subscriptionRouter } from "./routers/subscription";
import { aiRouter } from "./routers/ai";
import { notificationRouter } from "./routers/notification";
import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { reviewRouter } from "./routers/review";

export const appRouter = createTRPCRouter({
  listing: listingRouter,
  category: categoryRouter,
  user: userRouter,
  agent: agentRouter,
  favorite: favoriteRouter,
  message: messageRouter,
  search: searchRouter,
  subscription: subscriptionRouter,
  ai: aiRouter,
  notification: notificationRouter,
  admin: adminRouter,
  auth: authRouter,
  review: reviewRouter,
});

export type AppRouter = typeof appRouter;
