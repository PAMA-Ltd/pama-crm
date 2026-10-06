import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  companyResultValidator,
  createCompanyArgs,
} from "./companyModel";
import { requireCrmUser } from "./authz";

const MAX_LIST_LIMIT = 500;
const DEFAULT_LIST_LIMIT = 250;

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function validateCompanyInput(args: {
  name: string;
  openDeals: number;
  pipelineValue: number;
  winProbability: number;
}) {
  if (!args.name.trim()) {
    throw new Error("Company name is required.");
  }

  if (!Number.isFinite(args.openDeals) || args.openDeals < 0) {
    throw new Error("Open deals must be a non-negative number.");
  }

  if (!Number.isFinite(args.pipelineValue) || args.pipelineValue < 0) {
    throw new Error("Pipeline value must be a non-negative number.");
  }

  if (
    !Number.isFinite(args.winProbability) ||
    args.winProbability < 0 ||
    args.winProbability > 100
  ) {
    throw new Error("Win probability must be between 0 and 100.");
  }
}

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(companyResultValidator),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);

    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIST_LIMIT), 1),
      MAX_LIST_LIMIT,
    );

    const companies = await ctx.db.query("companies").order("desc").take(limit);

    return companies.map((company) => ({
      _id: company._id,
      _creationTime: company._creationTime,
      name: company.name,
      tags: company.tags,
      owner: company.owner,
      openDeals: company.openDeals,
      pipelineValue: company.pipelineValue,
      winProbability: company.winProbability,
      trend: company.trend,
      lastInteraction: company.lastInteraction,
      logo: company.logo,
    }));
  },
});

export const create = mutation({
  args: createCompanyArgs,
  returns: v.id("companies"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    validateCompanyInput(args);

    const name = args.name.trim();
    const normalizedName = normalizeName(name);

    const existing = await ctx.db
      .query("companies")
      .withIndex("by_normalized_name", (q) =>
        q.eq("normalizedName", normalizedName),
      )
      .first();

    if (existing) {
      throw new Error("A company with this name already exists.");
    }

    return await ctx.db.insert("companies", {
      ...args,
      name,
      normalizedName,
      createdBy: identity.subject,
      openDeals: Math.round(args.openDeals),
      pipelineValue: Math.round(args.pipelineValue),
      winProbability: Math.round(args.winProbability),
    });
  },
});
