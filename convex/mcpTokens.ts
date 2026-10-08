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
      expiresAt: v.optional(v.number()),
      permission: v.optional(v.union(v.literal("read"),v.literal("write"),v.literal("admin"))),
      organizationId: v.optional(v.id("organizations")),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const tokens = await ctx.db
      .query("mcpTokens")
      .withIndex("by_user", (q) => q.eq("userSubject", identity.subject))
      .order("desc")
      .take(300);

    // Ephemeral OAuth bridge sessions are not user-created API keys.
    return tokens.filter((token) => !token.oauthSession).slice(0, 100).map((token) => ({
      _id: token._id,
      label: token.label,
      tokenPrefix: token.tokenPrefix,
      createdAt: token.createdAt,
      revokedAt: token.revokedAt,
      expiresAt: token.expiresAt,
      permission: token.permission,
      organizationId: token.organizationId,
    }));
  },
});

export const register = mutation({
  args: {
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    expiresAt: v.optional(v.number()),
    permission: v.optional(v.union(v.literal("read"),v.literal("write"),v.literal("admin"))),
    organizationId: v.optional(v.id("organizations")),
  },
  returns: v.id("mcpTokens"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    if (!args.label.trim()) throw new Error("Token label is required.");
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash)) {
      throw new Error("Invalid token hash.");
    }

    const existing = await ctx.db
      .query("mcpTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (existing) throw new Error("Token already exists.");

    if(args.expiresAt && (args.expiresAt<=Date.now() || args.expiresAt>Date.now()+366*86400000)) throw new Error("Expiration must be in the next year.");
    if(args.organizationId){
      const org=await ctx.db.get(args.organizationId);
      const membership=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",args.organizationId!).eq("userSubject",identity.subject)).unique();
      if(!org || org.status!=="active" || !membership) throw new Error("Workspace access denied.");
    }
    return await ctx.db.insert("mcpTokens", {
      userSubject: identity.subject,
      label: args.label.trim(),
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
      expiresAt: args.expiresAt,
      permission: args.permission ?? "write",
      organizationId: args.organizationId,
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
