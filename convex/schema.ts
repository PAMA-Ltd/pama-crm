import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { companyFields } from "./companyModel";
import {
  activityTypeValidator,
  contactStatusValidator,
  dealStageValidator,
} from "./crmModels";

export default defineSchema({
  companies: defineTable(companyFields).index("by_normalized_name", [
    "normalizedName",
  ]),

  contacts: defineTable({
    firstName: v.string(),
    lastName: v.string(),
    normalizedName: v.string(),
    email: v.optional(v.string()),
    normalizedEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_normalized_email", ["normalizedEmail"]),

  deals: defineTable({
    name: v.string(),
    companyId: v.id("companies"),
    contactId: v.optional(v.id("contacts")),
    amount: v.number(),
    stage: dealStageValidator,
    probability: v.number(),
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_stage", ["stage"]),

  activities: defineTable({
    type: activityTypeValidator,
    subject: v.string(),
    description: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_completed_at", ["completedAt"]),
});
