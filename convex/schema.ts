import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { companyFields } from "./companyModel";
import {
  activitySourceValidator,
  activityTypeValidator,
  contactStatusValidator,
  dealStageValidator,
} from "./crmModels";
import {
  enrollmentStatusValidator,
  inviteStatusValidator,
  organizationRoleValidator,
  organizationStatusValidator,
  sequenceStatusValidator,
  sequenceStepValidator,
} from "./workspaceModels";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    status: organizationStatusValidator,
    planName: v.string(),
    billingEmail: v.optional(v.string()),
  }).index("by_slug", ["slug"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userSubject: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    role: organizationRoleValidator,
    teamId: v.optional(v.id("teams")),
    joinedAt: v.number(),
  })
    .index("by_user", ["userSubject"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_user", ["organizationId", "userSubject"])
    .index("by_organization_and_team", ["organizationId", "teamId"]),

  organizationInvites: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role: organizationRoleValidator,
    status: inviteStatusValidator,
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_organization_and_email", ["organizationId", "email"]),

  teams: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_slug", ["organizationId", "slug"]),

  pipelines: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_slug", ["organizationId", "slug"]),

  companies: defineTable(companyFields)
    .index("by_normalized_name", ["normalizedName"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_normalized_name", [
      "organizationId",
      "normalizedName",
    ])
    .index("by_organization_and_owner", ["organizationId", "ownerSubject"]),

  contacts: defineTable({
    organizationId: v.optional(v.id("organizations")),
    firstName: v.string(),
    lastName: v.string(),
    normalizedName: v.string(),
    email: v.optional(v.string()),
    normalizedEmail: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    ownerSubject: v.optional(v.string()),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_status", ["status"])
    .index("by_normalized_email", ["normalizedEmail"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_company", ["organizationId", "companyId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_email", [
      "organizationId",
      "normalizedEmail",
    ]),

  deals: defineTable({
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
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_stage", ["stage"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_company", ["organizationId", "companyId"])
    .index("by_organization_and_contact", ["organizationId", "contactId"])
    .index("by_organization_and_stage", ["organizationId", "stage"])
    .index("by_organization_and_pipeline", ["organizationId", "pipelineId"]),

  activities: defineTable({
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
    createdBy: v.string(),
    updatedAt: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_contact", ["contactId"])
    .index("by_deal", ["dealId"])
    .index("by_completed_at", ["completedAt"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_company", ["organizationId", "companyId"])
    .index("by_organization_and_contact", ["organizationId", "contactId"])
    .index("by_organization_and_deal", ["organizationId", "dealId"])
    .index("by_organization_and_completed_at", [
      "organizationId",
      "completedAt",
    ]),

  emailSequences: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    status: sequenceStatusValidator,
    steps: v.array(sequenceStepValidator),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  sequenceEnrollments: defineTable({
    organizationId: v.id("organizations"),
    sequenceId: v.id("emailSequences"),
    contactId: v.id("contacts"),
    status: enrollmentStatusValidator,
    currentStep: v.number(),
    nextStepAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_sequence", ["sequenceId"])
    .index("by_contact", ["contactId"])
    .index("by_sequence_and_contact", ["sequenceId", "contactId"]),

  mcpTokens: defineTable({
    userSubject: v.string(),
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user", ["userSubject"]),
});
