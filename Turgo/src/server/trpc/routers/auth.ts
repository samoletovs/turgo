import { z } from "zod";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure } from "@/server/trpc";
import { forgotPasswordSchema } from "@/lib/validators";
import { sendPasswordResetEmail } from "@/server/services/email";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export const authRouter = createTRPCRouter({
  /**
   * Request a password reset link.
   * Always returns success to prevent email enumeration.
   */
  requestPasswordReset: publicProcedure
    .input(forgotPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();

      const user = await ctx.db.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      });

      if (!user) {
        // Don't reveal whether the email exists
        return { success: true };
      }

      // Delete any existing password-reset tokens for this user
      await ctx.db.verificationToken.deleteMany({
        where: { identifier: `password-reset:${user.email}` },
      });

      // Generate a secure random token
      const token = randomBytes(32).toString("hex");

      await ctx.db.verificationToken.create({
        data: {
          identifier: `password-reset:${user.email}`,
          token,
          expires: new Date(Date.now() + TOKEN_EXPIRY_MS),
        },
      });

      await sendPasswordResetEmail(user.email, token);

      return { success: true };
    }),

  /**
   * Reset the password using a valid token.
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Find the token
      const verificationToken = await ctx.db.verificationToken.findUnique({
        where: { token: input.token },
      });

      if (!verificationToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token.",
        });
      }

      // Check expiry
      if (verificationToken.expires < new Date()) {
        // Clean up expired token
        await ctx.db.verificationToken.delete({
          where: {
            identifier_token: {
              identifier: verificationToken.identifier,
              token: verificationToken.token,
            },
          },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reset link has expired. Please request a new one.",
        });
      }

      // Extract email from identifier (password-reset:<email>)
      const email = verificationToken.identifier.replace("password-reset:", "");

      // Hash the new password
      const passwordHash = await bcrypt.hash(input.password, 12);

      // Update user password
      await ctx.db.user.update({
        where: { email },
        data: { passwordHash },
      });

      // Delete the used token
      await ctx.db.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });

      return { success: true };
    }),
});
