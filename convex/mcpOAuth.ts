import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

// A short-lived, server-created bridge to the existing MCP organization authorization.
// Only the Next.js MCP route can call this after Clerk verifies an OAuth access token.
// Never accept a user identity or a permission from a public, unauthenticated client.
const MAX_SESSION_AGE_MS = 5 * 60 * 1000;

function secretMatches(provided: string) {
  const expected = process.env.CRM_MCP_OAUTH_BRIDGE_SECRET;
  if (!expected || expected.length < 32) {
    throw new Error("CRM MCP OAuth bridge is not configured on Convex.");
  }
  // Equal-length, byte-independent comparison to avoid exposing the secret via timing.
  let mismatch = expected.length ^ provided.length;
  const length = Math.max(expected.length, provided.length);
  for (let i = 0; i < length; i += 1) {
    mismatch |= (expected.charCodeAt(i) || 0) ^ (provided.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

export const upsertSession = mutation({
  args: {
    bridgeSecret: v.string(),
    tokenHash: v.string(),
    userSubject: v.string(),
    clientId: v.string(),
    scopes: v.array(v.string()),
  },
  returns: v.object({ expiresAt: v.number(), permission: v.union(v.literal("read"), v.literal("write"), v.literal("admin")) }),
  handler: async (ctx, args) => {
    if (!secretMatches(args.bridgeSecret)) throw new Error("OAuth bridge authorization failed.");
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash) || !args.userSubject.startsWith("user_")) {
      throw new Error("Invalid OAuth bridge identity.");
    }
    const permissions = new Set(args.scopes);
    const permission: "read" | "write" | "admin" | null = permissions.has("crm:admin")
      ? "admin"
      : permissions.has("crm:write")
        ? "write"
        : permissions.has("crm:read")
          ? "read"
          : null;
    if (!permission) throw new Error("OAuth access token must include a CRM scope.");

    const now = Date.now();
    const expiresAt = now + MAX_SESSION_AGE_MS;
    const existing = await ctx.db
      .query("mcpTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (existing) {
      // Never allow a bridge request to overwrite an independently issued API token.
      if (!existing.oauthSession || existing.userSubject !== args.userSubject) {
        throw new Error("OAuth token identity collision.");
      }
      await ctx.db.patch(existing._id, {
        expiresAt,
        permission,
        revokedAt: undefined,
      });
    } else {
      await ctx.db.insert("mcpTokens", {
        userSubject: args.userSubject,
        label: "OAuth client: " + args.clientId.slice(0, 80),
        tokenHash: args.tokenHash,
        tokenPrefix: "oauth_",
        createdAt: now,
        expiresAt,
        permission,
        oauthSession: true,
      });
    }
    return { expiresAt, permission };
  },
});

export const cleanupExpiredSessions = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("mcpTokens")
      .withIndex("by_oauth_session_and_expiration", (q) =>
        q.eq("oauthSession", true).lt("expiresAt", Date.now()),
      )
      .take(200);
    for (const session of sessions) await ctx.db.delete(session._id);
    return sessions.length;
  },
});
