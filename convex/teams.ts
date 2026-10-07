import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrganizationAdmin,
  requireOrganizationMember,
} from "./authz";

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("teams"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      memberCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    const result = [];
    for (const team of teams) {
      const members = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_and_team", (q) =>
          q.eq("organizationId", args.organizationId).eq("teamId", team._id),
        )
        .take(250);
      result.push({
        _id: team._id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        memberCount: members.length,
      });
    }
    return result;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("teams"),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const name = args.name.trim();
    if (!name) throw new Error("Team name is required.");
    const slug = slugify(name);
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_organization_and_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", slug),
      )
      .unique();
    if (existing) throw new Error("A team with this name already exists.");

    return await ctx.db.insert("teams", {
      organizationId: args.organizationId,
      name,
      slug,
      description: args.description?.trim() || undefined,
      createdAt: Date.now(),
    });
  },
});

export const assignMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    teamId: v.optional(v.id("teams")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== args.organizationId) {
      throw new Error("Member not found.");
    }
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      if (!team || team.organizationId !== args.organizationId) {
        throw new Error("Team not found.");
      }
    }
    await ctx.db.patch(args.memberId, { teamId: args.teamId });
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    teamId: v.id("teams"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.organizationId !== args.organizationId) {
      throw new Error("Team not found.");
    }

    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_team", (q) =>
        q.eq("organizationId", args.organizationId).eq("teamId", args.teamId),
      )
      .take(250);
    for (const member of members) {
      await ctx.db.patch(member._id, { teamId: undefined });
    }
    await ctx.db.delete(args.teamId);
    return null;
  },
});
