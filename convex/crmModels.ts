import { v } from "convex/values";

export const contactStatusValidator = v.union(
  v.literal("Lead"),
  v.literal("Active"),
  v.literal("Customer"),
  v.literal("Inactive"),
);

export const dealStageValidator = v.union(
  v.literal("Lead"),
  v.literal("Qualified"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Won"),
  v.literal("Lost"),
);

export const activityTypeValidator = v.union(
  v.literal("Call"),
  v.literal("Email"),
  v.literal("Meeting"),
  v.literal("Note"),
  v.literal("Task"),
);

export const activitySourceValidator = v.union(
  v.literal("human"),
  v.literal("system"),
  v.literal("mcp"),
);

export const contactResultValidator = v.object({
  _id: v.id("contacts"),
  _creationTime: v.number(),
  organizationId: v.optional(v.id("organizations")),
  firstName: v.string(),
  lastName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  title: v.optional(v.string()),
  companyId: v.optional(v.id("companies")),
  ownerSubject: v.optional(v.string()),
  status: contactStatusValidator,
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

export const dealResultValidator = v.object({
  _id: v.id("deals"),
  _creationTime: v.number(),
  organizationId: v.optional(v.id("organizations")),
  name: v.string(),
  companyId: v.id("companies"),
  contactId: v.optional(v.id("contacts")),
  pipelineId: v.optional(v.id("pipelines")),
  amount: v.number(),
  stage: dealStageValidator,
  probability: v.number(),
  expectedCloseDate: v.optional(v.string()),
  notes: v.optional(v.string()),
  updatedAt: v.number(),
});

export const activityResultValidator = v.object({
  _id: v.id("activities"),
  _creationTime: v.number(),
  organizationId: v.optional(v.id("organizations")),
  type: activityTypeValidator,
  source: v.optional(activitySourceValidator),
  subject: v.string(),
  description: v.optional(v.string()),
  companyId: v.optional(v.id("companies")),
  contactId: v.optional(v.id("contacts")),
  dealId: v.optional(v.id("deals")),
  dueAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  updatedAt: v.number(),
});
