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
  workspaceModuleValidator,
  workspacePresetValidator,
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

  organizationSettings: defineTable({
    organizationId: v.id("organizations"),
    preset: workspacePresetValidator,
    enabledModules: v.array(workspaceModuleValidator),
    configVersion: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_organization", ["organizationId"]),

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
    .index("by_organization_and_owner", ["organizationId", "ownerSubject"])
    .searchIndex("search_company",{searchField:"name",filterFields:["organizationId"]}),

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
    ])
    .searchIndex("search_contact",{searchField:"normalizedName",filterFields:["organizationId"]}),

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
    .index("by_organization_and_pipeline", ["organizationId", "pipelineId"])
    .searchIndex("search_deal",{searchField:"name",filterFields:["organizationId"]}),

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

  emailEvents: defineTable({
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
    actorSubject: v.string(),
    subject: v.string(),
    providerMessageId: v.string(),
    kind: v.union(v.literal("manual"),v.literal("sequence")),
    createdAt: v.number(),
  }).index("by_organization",["organizationId"]),
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
    sendLockedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    nextStepAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_sequence", ["sequenceId"])
    .index("by_contact", ["contactId"])
    .index("by_sequence_and_contact", ["sequenceId", "contactId"])
    .index("by_status_and_next", ["status", "nextStepAt"]),

  lifecycleIntegrationKeys: defineTable({
    organizationId: v.id("organizations"),
    source: v.string(),
    environment: v.union(v.literal("staging"), v.literal("production")),
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    rateWindowAt: v.optional(v.number()),
    rateCalls: v.optional(v.number()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_organization", ["organizationId"]),

  lifecycleProfiles: defineTable({
    organizationId: v.id("organizations"),
    source: v.string(),
    subjectId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    contactId: v.optional(v.id("contacts")),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    lastEventType: v.optional(v.string()),
    lastEventOccurredAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    marketingConsent: v.optional(v.union(v.literal("opt_in"), v.literal("opt_out"))),
    consentUpdatedAt: v.optional(v.number()),
  })
    .index("by_organization_source_subject", ["organizationId", "source", "subjectId"])
    .index("by_organization_last_seen", ["organizationId", "lastSeenAt"]),

  lifecycleSegments: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    source: v.optional(v.string()),
    lastEventType: v.optional(v.string()),
    requiredTag: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  lifecycleCampaigns: defineTable({
    organizationId: v.id("organizations"),
    segmentId: v.id("lifecycleSegments"),
    name: v.string(),
    subject: v.string(),
    body: v.string(),
    status: v.union(v.literal("draft"), v.literal("archived")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  lifecycleAutomations: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    source: v.optional(v.string()),
    eventType: v.string(),
    tag: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused")),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  lifecycleAutomationRuns: defineTable({
    organizationId: v.id("organizations"),
    automationId: v.id("lifecycleAutomations"),
    profileId: v.id("lifecycleProfiles"),
    eventId: v.string(),
    outcome: v.union(v.literal("tagged"), v.literal("already_tagged"), v.literal("skipped_limit")),
    createdAt: v.number(),
  }).index("by_organization_created", ["organizationId", "createdAt"]),

  lifecycleEvents: defineTable({
    organizationId: v.id("organizations"),
    integrationId: v.id("lifecycleIntegrationKeys"),
    profileId: v.id("lifecycleProfiles"),
    source: v.string(),
    environment: v.union(v.literal("staging"), v.literal("production")),
    eventId: v.string(),
    type: v.string(),
    propertiesJson: v.string(),
    occurredAt: v.number(),
    receivedAt: v.number(),
  })
    .index("by_organization_source_env_event", ["organizationId", "source", "environment", "eventId"])
    .index("by_organization_received", ["organizationId", "receivedAt"])
    .index("by_profile_received", ["profileId", "receivedAt"]),

  lifecycleIngressAudit: defineTable({
    organizationId: v.id("organizations"),
    integrationId: v.id("lifecycleIntegrationKeys"),
    eventId: v.string(),
    outcome: v.union(v.literal("accepted"), v.literal("duplicate")),
    createdAt: v.number(),
  }).index("by_organization_created", ["organizationId", "createdAt"]),

  mcpAudit: defineTable({
    organizationId: v.optional(v.id("organizations")),
    actorSubject: v.string(),
    toolName: v.string(),
    targetId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_organization_and_created", ["organizationId", "createdAt"]),
  mcpTokens: defineTable({
    userSubject: v.string(),
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    permission: v.optional(v.union(v.literal("read"),v.literal("write"),v.literal("admin"))),
    organizationId: v.optional(v.id("organizations")),
    rateWindowAt: v.optional(v.number()),
    rateCalls: v.optional(v.number()),
    oauthSession: v.optional(v.boolean()),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user", ["userSubject"])
    .index("by_oauth_session_and_expiration", ["oauthSession", "expiresAt"]),
});
