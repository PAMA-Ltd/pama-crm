import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  companyResultValidator,
  createCompanyArgs,
} from "./companyModel";
import { requireCrmUser } from "./authz";

const MAX_LIST_LIMIT = 500;
const DEFAULT_LIST_LIMIT = 250;
const DEFAULT_TREND = [4, 4, 5, 5, 2, 7, 11, 7, 5, 7, 5, 3, 7, 14];

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
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
    const name = args.name.trim();
    if (!name) throw new Error("Company name is required.");

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
      name,
      normalizedName,
      createdBy: identity.subject,
      tags: args.tags,
      owner: identity.name ?? identity.email ?? "Pama CRM",
      openDeals: 0,
      pipelineValue: 0,
      winProbability: 0,
      trend: DEFAULT_TREND,
      lastInteraction: args.lastInteraction,
      logo: args.logo,
    });
  },
});
