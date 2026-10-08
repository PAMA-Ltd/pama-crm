import type { MutationCtx, QueryCtx } from "./_generated/server";

type DataContext = QueryCtx | MutationCtx;

export async function requireMcpToken(
  ctx: DataContext,
  tokenHash: string,
) {
  const token = await ctx.db
    .query("mcpTokens")
    .withIndex("by_hash", (q) => q.eq("tokenHash", tokenHash))
    .unique();

  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt <= Date.now())) {
    throw new Error("Invalid or revoked MCP token.");
  }

  return token;
}
