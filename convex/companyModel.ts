import { v } from "convex/values";

export const companyTagValidator = v.union(
  v.literal("Enterprise"),
  v.literal("Mid-Market"),
  v.literal("SMB"),
  v.literal("Strategic"),
  v.literal("New Logo"),
  v.literal("Upsell"),
  v.literal("Expansion"),
  v.literal("Renewal"),
  v.literal("Pilot"),
  v.literal("Co-Sell"),
  v.literal("Land & Expand"),
);

export const lastInteractionValidator = v.object({
  date: v.string(),
  label: v.string(),
});

export const companyFields = {
  name: v.string(),
  normalizedName: v.string(),
  createdBy: v.string(),
  tags: v.array(companyTagValidator),
  owner: v.string(),
  openDeals: v.number(),
  pipelineValue: v.number(),
  winProbability: v.number(),
  trend: v.array(v.number()),
  lastInteraction: lastInteractionValidator,
  logo: v.optional(v.string()),
};

export const companyResultValidator = v.object({
  _id: v.id("companies"),
  _creationTime: v.number(),
  name: v.string(),
  tags: v.array(companyTagValidator),
  owner: v.string(),
  openDeals: v.number(),
  pipelineValue: v.number(),
  winProbability: v.number(),
  trend: v.array(v.number()),
  lastInteraction: lastInteractionValidator,
  logo: v.optional(v.string()),
});

export const createCompanyArgs = {
  name: v.string(),
  tags: v.array(companyTagValidator),
  owner: v.string(),
  openDeals: v.number(),
  pipelineValue: v.number(),
  winProbability: v.number(),
  trend: v.array(v.number()),
  lastInteraction: lastInteractionValidator,
  logo: v.optional(v.string()),
};
