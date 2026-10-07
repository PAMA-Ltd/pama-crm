import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrganizationMember } from "./authz";
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
  organizationId: Id<"organizations">,
  companyId: Id<"companies">,
) {
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_organization_and_company", (q) =>
      q.eq("organizationId", organizationId).eq("companyId", companyId),
    )
    .take(500);

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

  await ctx.db.patch(companyId, {
    openDeals: openDeals.length,
    pipelineValue: Math.round(pipelineValue),
    winProbability:
      pipelineValue > 0 ? Math.round(weighted / pipelineValue) : 0,
  });
}

async function validateLinks(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  companyId: Id<"companies">,
  contactId?: Id<"contacts">,
  pipelineId?: Id<"pipelines">,
) {
  const company = await ctx.db.get(companyId);
  if (!company || company.organizationId !== organizationId) {
    throw new Error("Company not found.");
  }

  if (contactId) {
    const contact = await ctx.db.get(contactId);
    if (!contact || contact.organizationId !== organizationId) {
      throw new Error("Contact not found.");
    }
    if (contact.companyId && contact.companyId !== companyId) {
      throw new Error("The selected contact belongs to another company.");
    }
  }

  if (pipelineId) {
    const pipeline = await ctx.db.get(pipelineId);
    if (!pipeline || pipeline.organizationId !== organizationId) {
      throw new Error("Pipeline not found.");
    }
  }
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    pipelineId: v.optional(v.id("pipelines")),
    limit: v.optional(v.number()),
  },
  returns: v.array(dealResultValidator),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIST_LIMIT,
    );
    const deals = args.pipelineId
      ? await ctx.db
          .query("deals")
          .withIndex("by_organization_and_pipeline", (q) =>
            q
              .eq("organizationId", args.organizationId)
              .eq("pipelineId", args.pipelineId),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("deals")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", args.organizationId),
          )
          .order("desc")
          .take(limit);

    return deals.map((deal) => ({
      _id: deal._id,
      _creationTime: deal._creationTime,
      organizationId: deal.organizationId,
      name: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      pipelineId: deal.pipelineId,
      amount: deal.amount,
      stage: deal.stage,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      notes: deal.notes,
      updatedAt: deal.updatedAt,
    }));
  },
});

const MAX_LIST_LIMIT = MAX_LIMIT;

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    companyId: v.id("companies"),
    contactId: v.optional(v.id("contacts")),
    pipelineId: v.optional(v.id("pipelines")),
    amount: v.number(),
    stage: dealStageValidator,
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("deals"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Deal name is required.");
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Deal amount must be a non-negative number.");
    }

    await validateLinks(
      ctx,
      args.organizationId,
      args.companyId,
      args.contactId,
      args.pipelineId,
    );

    const id = await ctx.db.insert("deals", {
      organizationId: args.organizationId,
      name,
      companyId: args.companyId,
      contactId: args.contactId,
      pipelineId: args.pipelineId,
      amount: Math.round(args.amount),
      stage: args.stage,
      probability: probabilityByStage[args.stage],
      expectedCloseDate: cleanOptional(args.expectedCloseDate),
      notes: cleanOptional(args.notes),
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

    await refreshCompanyMetrics(ctx, args.organizationId, args.companyId);
    return id;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    dealId: v.id("deals"),
    name: v.string(),
    companyId: v.id("companies"),
    contactId: v.optional(v.id("contacts")),
    pipelineId: v.optional(v.id("pipelines")),
    amount: v.number(),
    stage: dealStageValidator,
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const deal = await ctx.db.get(args.dealId);
    if (!deal || deal.organizationId !== args.organizationId) {
      throw new Error("Deal not found.");
    }
    if (!args.name.trim()) throw new Error("Deal name is required.");
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Deal amount must be a non-negative number.");
    }

    await validateLinks(
      ctx,
      args.organizationId,
      args.companyId,
      args.contactId,
      args.pipelineId,
    );

    const previousCompanyId = deal.companyId;
    const stageChanged = deal.stage !== args.stage;

    await ctx.db.patch(args.dealId, {
      name: args.name.trim(),
      companyId: args.companyId,
      contactId: args.contactId,
      pipelineId: args.pipelineId,
      amount: Math.round(args.amount),
      stage: args.stage,
      probability: probabilityByStage[args.stage],
      expectedCloseDate: cleanOptional(args.expectedCloseDate),
      notes: cleanOptional(args.notes),
      updatedAt: Date.now(),
    });

    if (stageChanged) {
      await ctx.db.insert("activities", {
        organizationId: args.organizationId,
        type: "Note",
        source: "system",
        subject: `Deal moved to ${args.stage}`,
        description: args.name.trim(),
        companyId: args.companyId,
        contactId: args.contactId,
        dealId: args.dealId,
        createdBy: identity.subject,
        updatedAt: Date.now(),
      });
    }

    await refreshCompanyMetrics(ctx, args.organizationId, args.companyId);
    if (previousCompanyId !== args.companyId) {
      await refreshCompanyMetrics(
        ctx,
        args.organizationId,
        previousCompanyId,
      );
    }
    return null;
  },
});

export const updateStage = mutation({
  args: {
    organizationId: v.id("organizations"),
    dealId: v.id("deals"),
    stage: dealStageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const deal = await ctx.db.get(args.dealId);
    if (!deal || deal.organizationId !== args.organizationId) {
      throw new Error("Deal not found.");
    }

    await ctx.db.patch(args.dealId, {
      stage: args.stage,
      probability: probabilityByStage[args.stage],
      updatedAt: Date.now(),
    });

    await ctx.db.insert("activities", {
      organizationId: args.organizationId,
      type: "Note",
      source: "system",
      subject: `Deal moved to ${args.stage}`,
      description: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      dealId: deal._id,
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });

    await refreshCompanyMetrics(
      ctx,
      args.organizationId,
      deal.companyId,
    );
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    dealId: v.id("deals"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const deal = await ctx.db.get(args.dealId);
    if (!deal || deal.organizationId !== args.organizationId) return null;

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization_and_deal", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("dealId", args.dealId),
      )
      .take(500);
    for (const activity of activities) {
      await ctx.db.patch(activity._id, { dealId: undefined });
    }
    await ctx.db.delete(args.dealId);
    await refreshCompanyMetrics(
      ctx,
      args.organizationId,
      deal.companyId,
    );
    return null;
  },
});
