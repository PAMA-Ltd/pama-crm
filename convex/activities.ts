import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCrmUser } from "./authz";
import {
  activityResultValidator,
  activityTypeValidator,
} from "./crmModels";

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 500;

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(activityResultValidator),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );
    const activities = await ctx.db
      .query("activities")
      .order("desc")
      .take(limit);

    return activities.map((activity) => ({
      _id: activity._id,
      _creationTime: activity._creationTime,
      type: activity.type,
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
    type: activityTypeValidator,
    subject: v.string(),
    description: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.id("activities"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const subject = args.subject.trim();
    if (!subject) throw new Error("Activity subject is required.");

    if (args.companyId && !(await ctx.db.get(args.companyId))) {
      throw new Error("Company not found.");
    }
    if (args.contactId && !(await ctx.db.get(args.contactId))) {
      throw new Error("Contact not found.");
    }
    if (args.dealId && !(await ctx.db.get(args.dealId))) {
      throw new Error("Deal not found.");
    }

    return await ctx.db.insert("activities", {
      type: args.type,
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

export const setCompleted = mutation({
  args: {
    activityId: v.id("activities"),
    completed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found.");

    await ctx.db.patch(args.activityId, {
      completedAt: args.completed ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { activityId: v.id("activities") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    if (await ctx.db.get(args.activityId)) {
      await ctx.db.delete(args.activityId);
    }
    return null;
  },
});
