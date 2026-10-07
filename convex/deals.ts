import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireCrmUser } from "./authz";
import { dealResultValidator, dealStageValidator } from "./crmModels";

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;

const probabilityByStage = {
  Lead: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
} as const;

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

async function refreshCompanyMetrics(
  ctx: MutationCtx,
  companyId: Id<"companies">,
) {
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_company", (q) => q.eq("companyId", companyId))
    .collect();

  const openDeals = deals.filter(
    (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
  );
  const pipelineValue = openDeals.reduce(
    (total, deal) => total + deal.amount,
    0,
  );
  const weighted = openDeals.reduce(
    (total, deal) => total + deal.amount * deal.probability,
    0,
  );
  const winProbability =
    pipelineValue > 0 ? Math.round(weighted / pipelineValue) : 0;

  await ctx.db.patch(companyId, {
    openDeals: openDeals.length,
    pipelineValue: Math.round(pipelineValue),
    winProbability,
  });
}

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(dealResultValidator),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );
    const deals = await ctx.db.query("deals").order("desc").take(limit);

    return deals.map((deal) => ({
      _id: deal._id,
      _creationTime: deal._creationTime,
      name: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      amount: deal.amount,
      stage: deal.stage,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      notes: deal.notes,
      updatedAt: deal.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    companyId: v.id("companies"),
    contactId: v.optional(v.id("contacts")),
    amount: v.number(),
    stage: dealStageValidator,
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Deal name is required.");
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Deal amount must be a non-negative number.");
    }
    if (!(await ctx.db.get(args.companyId))) throw new Error("Company not found.");

    if (args.contactId) {
      const contact = await ctx.db.get(args.contactId);
      if (!contact) throw new Error("Contact not found.");
      if (contact.companyId && contact.companyId !== args.companyId) {
        throw new Error("The selected contact belongs to another company.");
      }
    }

    const id = await ctx.db.insert("deals", {
      name,
      companyId: args.companyId,
      contactId: args.contactId,
      amount: Math.round(args.amount),
      stage: args.stage,
      probability: probabilityByStage[args.stage],
      expectedCloseDate: cleanOptional(args.expectedCloseDate),
      notes: cleanOptional(args.notes),
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

    await refreshCompanyMetrics(ctx, args.companyId);
    return id;
  },
});

export const updateStage = mutation({
  args: {
    dealId: v.id("deals"),
    stage: dealStageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) throw new Error("Deal not found.");

    await ctx.db.patch(args.dealId, {
      stage: args.stage,
      probability: probabilityByStage[args.stage],
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      type: "Note",
      subject: `Deal moved to ${args.stage}`,
      description: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      dealId: deal._id,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

    await refreshCompanyMetrics(ctx, deal.companyId);
    return null;
  },
});

export const remove = mutation({
  args: { dealId: v.id("deals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const deal = await ctx.db.get(args.dealId);
    if (!deal) return null;

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_deal", (q) => q.eq("dealId", args.dealId))
      .collect();
    await Promise.all(activities.map((activity) => ctx.db.delete(activity._id)));
    await ctx.db.delete(args.dealId);
    await refreshCompanyMetrics(ctx, deal.companyId);
    return null;
  },
});
