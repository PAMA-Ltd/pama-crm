import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCrmUser } from "./authz";

export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("mcpTokens"),
      label: v.string(),
      tokenPrefix: v.string(),
      createdAt: v.number(),
      revokedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const tokens = await ctx.db
      .query("mcpTokens")
      .withIndex("by_user", (q) => q.eq("userSubject", identity.subject))
      .order("desc")
      .take(100);

    return tokens.map((token) => ({
      _id: token._id,
      label: token.label,
      tokenPrefix: token.tokenPrefix,
      createdAt: token.createdAt,
      revokedAt: token.revokedAt,
    }));
  },
});

export const register = mutation({
  args: {
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
  },
  returns: v.id("mcpTokens"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (!args.label.trim()) throw new Error("Token label is required.");
    if (args.tokenHash.length !== 64) throw new Error("Invalid token hash.");

    const existing = await ctx.db
      .query("mcpTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (existing) throw new Error("Token already exists.");

    return await ctx.db.insert("mcpTokens", {
      userSubject: identity.subject,
      label: args.label.trim(),
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      createdAt: Date.now(),
    });
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("mcpTokens") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userSubject !== identity.subject) {
      throw new Error("Token not found.");
    }
    await ctx.db.patch(args.tokenId, { revokedAt: Date.now() });
    return null;
  },
});

export async function verifyMcpTokenHash(
  ctx: Parameters<typeof query>[0] extends never ? never : never,
  _tokenHash: string,
) {
  throw new Error("Use verifyMcpTokenHashFromDb from mcpAuth.");
}
