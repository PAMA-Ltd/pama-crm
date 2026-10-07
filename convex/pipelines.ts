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
      _id: v.id("pipelines"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      isDefault: v.boolean(),
      dealCount: v.number(),
      openValue: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const pipelines = await ctx.db
      .query("pipelines")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    const result = [];
    for (const pipeline of pipelines) {
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_organization_and_pipeline", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("pipelineId", pipeline._id),
        )
        .take(500);
      const open = deals.filter(
        (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
      );
      result.push({
        _id: pipeline._id,
        name: pipeline.name,
        slug: pipeline.slug,
        description: pipeline.description,
        isDefault: pipeline.isDefault,
        dealCount: deals.length,
        openValue: open.reduce((sum, deal) => sum + deal.amount, 0),
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
  returns: v.id("pipelines"),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const name = args.name.trim();
    if (!name) throw new Error("Pipeline name is required.");
    const slug = slugify(name);
    const existing = await ctx.db
      .query("pipelines")
      .withIndex("by_organization_and_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", slug),
      )
      .unique();
    if (existing) throw new Error("A pipeline with this name already exists.");

    return await ctx.db.insert("pipelines", {
      organizationId: args.organizationId,
      name,
      slug,
      description: args.description?.trim() || undefined,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    pipelineId: v.id("pipelines"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const pipeline = await ctx.db.get(args.pipelineId);
    if (!pipeline || pipeline.organizationId !== args.organizationId) {
      throw new Error("Pipeline not found.");
    }
    if (pipeline.isDefault) throw new Error("The default pipeline cannot be deleted.");

    const deal = await ctx.db
      .query("deals")
      .withIndex("by_organization_and_pipeline", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("pipelineId", args.pipelineId),
      )
      .first();
    if (deal) throw new Error("Move deals out of this pipeline before deleting it.");

    await ctx.db.delete(args.pipelineId);
    return null;
  },
});
