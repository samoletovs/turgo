export const MESSAGE_REACTIONS = ['👍', '❤️', '😂'] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTIONS)[number];

export function parseMessageReactions(rawReactions: unknown): Record<string, string[]> {
  if (!rawReactions || typeof rawReactions !== 'object' || Array.isArray(rawReactions)) {
    return {};
  }

  const allowedReactions = new Set<string>(MESSAGE_REACTIONS);

  return Object.fromEntries(
    Object.entries(rawReactions)
      .filter(([emoji]) => allowedReactions.has(emoji))
      .map(([emoji, users]) => [
        emoji,
        Array.isArray(users)
          ? users.filter((userId): userId is string => typeof userId === 'string')
          : [],
      ]),
  );
}
