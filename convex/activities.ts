import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrganizationMember } from "./authz";
import {
  activityResultValidator,
  activitySourceValidator,
  activityTypeValidator,
} from "./crmModels";

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 500;

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

async function validateLinks(
  ctx: Parameters<typeof requireOrganizationMember>[0],
  organizationId: Parameters<typeof requireOrganizationMember>[1],
  companyId?: any,
  contactId?: any,
  dealId?: any,
) {
  if (companyId) {
    const company = await ctx.db.get(companyId);
    if (!company || company.organizationId !== organizationId) {
      throw new Error("Company not found.");
    }
  }
  if (contactId) {
    const contact = await ctx.db.get(contactId);
    if (!contact || contact.organizationId !== organizationId) {
      throw new Error("Contact not found.");
    }
  }
  if (dealId) {
    const deal = await ctx.db.get(dealId);
    if (!deal || deal.organizationId !== organizationId) {
      throw new Error("Deal not found.");
    }
  }
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(activityResultValidator),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);

    return activities.map((activity) => ({
      _id: activity._id,
      _creationTime: activity._creationTime,
      organizationId: activity.organizationId,
      type: activity.type,
      source: activity.source,
      subject: activity.subject,
      description: activity.description,
      companyId: activity.companyId,
      contactId: activity.contactId,
      dealId: activity.dealId,
      dueAt: activity.dueAt,
      completedAt: activity.completedAt,
      updatedAt: activity.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    type: activityTypeValidator,
    source: v.optional(activitySourceValidator),
    subject: v.string(),
    description: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const subject = args.subject.trim();
    if (!subject) throw new Error("Activity subject is required.");

    await validateLinks(
      ctx,
      args.organizationId,
      args.companyId,
      args.contactId,
      args.dealId,
    );

    return await ctx.db.insert("activities", {
      organizationId: args.organizationId,
      type: args.type,
      source: args.source ?? "human",
      subject,
      description: cleanOptional(args.description),
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      dueAt: args.dueAt,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    activityId: v.id("activities"),
    type: activityTypeValidator,
    subject: v.string(),
    description: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.organizationId !== args.organizationId) {
      throw new Error("Activity not found.");
    }
    const subject = args.subject.trim();
    if (!subject) throw new Error("Activity subject is required.");

    await validateLinks(
      ctx,
      args.organizationId,
      args.companyId,
      args.contactId,
      args.dealId,
    );

    await ctx.db.patch(args.activityId, {
      type: args.type,
      subject,
      description: cleanOptional(args.description),
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      dueAt: args.dueAt,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const setCompleted = mutation({
  args: {
    organizationId: v.id("organizations"),
    activityId: v.id("activities"),
    completed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.organizationId !== args.organizationId) {
      throw new Error("Activity not found.");
    }

    await ctx.db.patch(args.activityId, {
      completedAt: args.completed ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    activityId: v.id("activities"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const activity = await ctx.db.get(args.activityId);
    if (activity && activity.organizationId === args.organizationId) {
      await ctx.db.delete(args.activityId);
    }
    return null;
  },
});
