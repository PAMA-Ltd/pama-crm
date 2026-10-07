import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  companyResultValidator,
  companyTagValidator,
  createCompanyArgs,
  lastInteractionValidator,
} from "./companyModel";
import {
  requireOrganizationMember,
  getOrganizationMember,
} from "./authz";

const MAX_LIST_LIMIT = 500;
const DEFAULT_LIST_LIMIT = 250;
const DEFAULT_TREND = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

async function resolveOwner(
  ctx: Parameters<typeof getOrganizationMember>[0],
  organizationId: Id<"organizations">,
  fallbackSubject: string,
  requestedSubject?: string,
) {
  const subject = requestedSubject || fallbackSubject;
  const member = await getOrganizationMember(ctx, organizationId, subject);
  if (!member) throw new Error("Selected owner is not a member of this organization.");
  return {
    subject,
    label: member.name || member.email || "CRM member",
  };
}

function mapCompany(company: {
  _id: Id<"companies">;
  _creationTime: number;
  organizationId?: Id<"organizations">;
  name: string;
  ownerSubject?: string;
  owner: string;
  tags: Array<
    | "Enterprise"
    | "Mid-Market"
    | "SMB"
    | "Strategic"
    | "New Logo"
    | "Upsell"
    | "Expansion"
    | "Renewal"
    | "Pilot"
    | "Co-Sell"
    | "Land & Expand"
  >;
  openDeals: number;
  pipelineValue: number;
  winProbability: number;
  trend: number[];
  lastInteraction: { date: string; label: string };
  logo?: string;
}) {
  return {
    _id: company._id,
    _creationTime: company._creationTime,
    organizationId: company.organizationId,
    name: company.name,
    ownerSubject: company.ownerSubject,
    owner: company.owner,
    tags: company.tags,
    openDeals: company.openDeals,
    pipelineValue: company.pipelineValue,
    winProbability: company.winProbability,
    trend: company.trend,
    lastInteraction: company.lastInteraction,
    logo: company.logo,
  };
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(companyResultValidator),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIST_LIMIT), 1),
      MAX_LIST_LIMIT,
    );
    const rows = await ctx.db
      .query("companies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);
    return rows.map(mapCompany);
  },
});

export const get = query({
  args: {
    organizationId: v.id("organizations"),
    companyId: v.id("companies"),
  },
  returns: v.union(companyResultValidator, v.null()),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const company = await ctx.db.get(args.companyId);
    if (!company || company.organizationId !== args.organizationId) return null;
    return mapCompany(company);
  },
});

export const create = mutation({
  args: createCompanyArgs,
  returns: v.id("companies"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Company name is required.");
    const normalizedName = normalizeName(name);

    const existing = await ctx.db
      .query("companies")
      .withIndex("by_organization_and_normalized_name", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("normalizedName", normalizedName),
      )
      .unique();
    if (existing) throw new Error("A company with this name already exists.");

    const owner = await resolveOwner(
      ctx,
      args.organizationId,
      identity.subject,
      args.ownerSubject,
    );

    return await ctx.db.insert("companies", {
      organizationId: args.organizationId,
      name,
      normalizedName,
      createdBy: identity.subject,
      ownerSubject: owner.subject,
      owner: owner.label,
      tags: args.tags,
      openDeals: 0,
      pipelineValue: 0,
      winProbability: 0,
      trend: DEFAULT_TREND,
      lastInteraction: args.lastInteraction,
      logo: args.logo,
    });
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    companyId: v.id("companies"),
    name: v.string(),
    tags: v.array(companyTagValidator),
    ownerSubject: v.optional(v.string()),
    lastInteraction: lastInteractionValidator,
    logo: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const company = await ctx.db.get(args.companyId);
    if (!company || company.organizationId !== args.organizationId) {
      throw new Error("Company not found.");
    }

    const name = args.name.trim();
    if (!name) throw new Error("Company name is required.");
    const normalizedName = normalizeName(name);

    const duplicate = await ctx.db
      .query("companies")
      .withIndex("by_organization_and_normalized_name", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("normalizedName", normalizedName),
      )
      .unique();
    if (duplicate && duplicate._id !== args.companyId) {
      throw new Error("A company with this name already exists.");
    }

    const owner = await resolveOwner(
      ctx,
      args.organizationId,
      identity.subject,
      args.ownerSubject ?? company.ownerSubject,
    );

    await ctx.db.patch(args.companyId, {
      name,
      normalizedName,
      tags: args.tags,
      ownerSubject: owner.subject,
      owner: owner.label,
      lastInteraction: args.lastInteraction,
      logo: args.logo,
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    companyId: v.id("companies"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const company = await ctx.db.get(args.companyId);
    if (!company || company.organizationId !== args.organizationId) return null;

    const [contact, deal, activity] = await Promise.all([
      ctx.db
        .query("contacts")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .first(),
      ctx.db
        .query("deals")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .first(),
      ctx.db
        .query("activities")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .first(),
    ]);
    if (contact || deal || activity) {
      throw new Error(
        "Remove or reassign this company's contacts, deals and activities before deleting it.",
      );
    }

    await ctx.db.delete(args.companyId);
    return null;
  },
});

export const importBatch = mutation({
  args: {
    organizationId: v.id("organizations"),
    rows: v.array(
      v.object({
        name: v.string(),
        tags: v.array(companyTagValidator),
        ownerSubject: v.optional(v.string()),
        lastInteraction: v.optional(lastInteractionValidator),
        logo: v.optional(v.string()),
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    skipped: v.number(),
    errors: v.array(v.object({ row: v.number(), message: v.string() })),
  }),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    if (args.rows.length > 500) {
      throw new Error("Import a maximum of 500 companies at a time.");
    }

    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const name = row.name.trim();
      if (!name) {
        errors.push({ row: index + 1, message: "Company name is required." });
        skipped += 1;
        continue;
      }

      const normalizedName = normalizeName(name);
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_organization_and_normalized_name", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("normalizedName", normalizedName),
        )
        .unique();
      if (existing) {
        errors.push({ row: index + 1, message: "Duplicate company name." });
        skipped += 1;
        continue;
      }

      try {
        const owner = await resolveOwner(
          ctx,
          args.organizationId,
          identity.subject,
          row.ownerSubject,
        );
        await ctx.db.insert("companies", {
          organizationId: args.organizationId,
          name,
          normalizedName,
          createdBy: identity.subject,
          ownerSubject: owner.subject,
          owner: owner.label,
          tags: row.tags,
          openDeals: 0,
          pipelineValue: 0,
          winProbability: 0,
          trend: DEFAULT_TREND,
          lastInteraction:
            row.lastInteraction ?? {
              date: new Date().toISOString().slice(0, 10),
              label: "Imported",
            },
          logo: row.logo,
        });
        created += 1;
      } catch (error) {
        skipped += 1;
        errors.push({
          row: index + 1,
          message: error instanceof Error ? error.message : "Import failed.",
        });
      }
    }

    return { created, skipped, errors };
  },
});
