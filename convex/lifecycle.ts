import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOrganizationAdmin, requireOrganizationMember } from "./authz";
import { validIntegrationSource, normalizeLifecycleEvent } from "../lib/lifecycle/event-contract";

const environmentValidator = v.union(v.literal("staging"), v.literal("production"));
const EVENT_RATE_WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

async function enabled(ctx: QueryCtx | MutationCtx, organizationId: Id<"organizations">) {
  const settings = await ctx.db.query("organizationSettings")
    .withIndex("by_organization", q => q.eq("organizationId", organizationId)).unique();
  return settings?.enabledModules.includes("lifecycle") ?? false;
}

export const listIntegrations = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await requireOrganizationAdmin(ctx, organizationId);
    const keys = await ctx.db.query("lifecycleIntegrationKeys")
      .withIndex("by_organization", q => q.eq("organizationId", organizationId))
      .order("desc").take(100);
    return keys.map(({ _id, source, environment, label, tokenPrefix, createdAt, expiresAt, revokedAt }) =>
      ({ _id, source, environment, label, tokenPrefix, createdAt, expiresAt, revokedAt }));
  },
});

export const registerIntegration = mutation({
  args: {
    organizationId: v.id("organizations"),
    source: v.string(),
    environment: environmentValidator,
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationAdmin(ctx, args.organizationId);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization || organization.status !== "active") throw new Error("Active organization required.");
    if (!(await enabled(ctx, args.organizationId))) throw new Error("Enable Lifecycle in workspace settings first.");
    if (!validIntegrationSource(args.source)) throw new Error("Invalid integration source.");
    if (!args.label.trim() || args.label.length > 80) throw new Error("Invalid integration label.");
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash) || !/^pama_evt_[a-f0-9]{11}$/.test(args.tokenPrefix)) {
      throw new Error("Invalid credential metadata.");
    }
    if (args.expiresAt <= Date.now() || args.expiresAt > Date.now() + 366 * 86_400_000) {
      throw new Error("Credential expiry must be within one year.");
    }
    if (await ctx.db.query("lifecycleIntegrationKeys").withIndex("by_hash", q => q.eq("tokenHash", args.tokenHash)).unique()) {
      throw new Error("Credential already exists.");
    }
    return ctx.db.insert("lifecycleIntegrationKeys", {
      organizationId: args.organizationId, source: args.source, environment: args.environment,
      label: args.label.trim(), tokenHash: args.tokenHash, tokenPrefix: args.tokenPrefix,
      expiresAt: args.expiresAt, createdBy: identity.subject, createdAt: Date.now(),
    });
  },
});

export const revokeIntegration = mutation({
  args: { organizationId: v.id("organizations"), integrationId: v.id("lifecycleIntegrationKeys") },
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const key = await ctx.db.get(args.integrationId);
    if (!key || key.organizationId !== args.organizationId) throw new Error("Integration not found.");
    if (!key.revokedAt) await ctx.db.patch(args.integrationId, { revokedAt: Date.now() });
    return null;
  },
});

export const listIngressAudit = query({
  args: { organizationId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { organizationId, limit }) => {
    await requireOrganizationAdmin(ctx, organizationId);
    const rows = await ctx.db.query("lifecycleIngressAudit")
      .withIndex("by_organization_created", q => q.eq("organizationId", organizationId))
      .order("desc").take(Math.min(50, Math.max(1, Math.floor(limit ?? 20))));
    return rows.map(({ _id, integrationId, eventId, outcome, createdAt }) =>
      ({ _id, integrationId, eventId, outcome, createdAt }));
  },
});

export const listEvents = query({
  args: { organizationId: v.id("organizations"), limit: v.optional(v.number()) },
  handler: async (ctx, { organizationId, limit }) => {
    await requireOrganizationMember(ctx, organizationId);
    if (!(await enabled(ctx, organizationId))) return [];
    const rows = await ctx.db.query("lifecycleEvents")
      .withIndex("by_organization_received", q => q.eq("organizationId", organizationId))
      .order("desc").take(Math.min(100, Math.max(1, Math.floor(limit ?? 50))));
    return rows.map(({ _id, source, environment, eventId, type, profileId, occurredAt, receivedAt }) =>
      ({ _id, source, environment, eventId, type, profileId, occurredAt, receivedAt }));
  },
});

/**
 * Private Next.js server bridge: never accept user-supplied identity or source
 * without authenticating its integration key in the same Convex transaction.
 * The bridge is a separate machine secret, never a CRM MCP token.
 */
export const ingest = mutation({
  args: {
    bridgeSecret: v.string(),
    tokenHash: v.string(),
    organizationSlug: v.string(),
    source: v.string(),
    environment: environmentValidator,
    eventId: v.string(),
    type: v.string(),
    subjectId: v.string(),
    occurredAt: v.number(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    propertiesJson: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.CRM_LIFECYCLE_BRIDGE_SECRET;
    const activeEnvironment = process.env.CRM_LIFECYCLE_ENVIRONMENT;
    if (!expectedSecret || expectedSecret.length < 32 || !activeEnvironment ||
        !["staging", "production"].includes(activeEnvironment)) {
      throw new Error("Lifecycle ingestion is not configured.");
    }
    // Branchless whole-string comparison to avoid early-exit credential checks.
    let diff = expectedSecret.length ^ args.bridgeSecret.length;
    for (let i = 0; i < Math.max(expectedSecret.length, args.bridgeSecret.length); i++) {
      diff |= (expectedSecret.charCodeAt(i) || 0) ^ (args.bridgeSecret.charCodeAt(i) || 0);
    }
    if (diff !== 0) throw new Error("Invalid integration credential.");
    if (args.environment !== activeEnvironment) throw new Error("Integration environment mismatch.");
    if (!/^[a-f0-9]{64}$/.test(args.tokenHash)) throw new Error("Invalid integration credential.");
    // Re-check event validation at the storage boundary, not just in Next.js.
    const normalized = normalizeLifecycleEvent({ ...args, properties: JSON.parse(args.propertiesJson) });
    if (normalized.propertiesJson !== args.propertiesJson) throw new Error("Invalid serialized event properties.");
    const key = await ctx.db.query("lifecycleIntegrationKeys")
      .withIndex("by_hash", q => q.eq("tokenHash", args.tokenHash)).unique();
    if (!key || key.revokedAt || key.expiresAt <= Date.now() ||
        key.environment !== args.environment || key.source !== args.source) {
      throw new Error("Invalid integration credential.");
    }
    const organization = await ctx.db.get(key.organizationId);
    if (!organization || organization.status !== "active" || organization.slug !== args.organizationSlug ||
        !(await enabled(ctx, key.organizationId))) {
      throw new Error("Integration workspace access denied.");
    }
    const now = Date.now();
    const windowAt = key.rateWindowAt ?? 0;
    const calls = now - windowAt >= EVENT_RATE_WINDOW_MS ? 0 : key.rateCalls ?? 0;
    if (calls >= MAX_PER_WINDOW) throw new Error("Integration rate limit exceeded.");
    await ctx.db.patch(key._id, {
      rateWindowAt: calls === 0 ? now : windowAt,
      rateCalls: calls + 1,
    });

    const existing = await ctx.db.query("lifecycleEvents")
      .withIndex("by_organization_source_env_event", q => q
        .eq("organizationId", key.organizationId)
        .eq("source", key.source)
        .eq("environment", key.environment)
        .eq("eventId", args.eventId)).unique();
    if (existing) {
      // A reused eventId with different content is a conflict, not a retry.
      const existingProfile = await ctx.db.get(existing.profileId);
      if (existing.type !== args.type || existing.occurredAt !== args.occurredAt ||
          existing.propertiesJson !== args.propertiesJson ||
          existingProfile?.subjectId !== args.subjectId) {
        throw new Error("Event ID already used for different content.");
      }
      await ctx.db.insert("lifecycleIngressAudit", {
        organizationId: key.organizationId, integrationId: key._id,
        eventId: args.eventId, outcome: "duplicate", createdAt: now,
      });
      return { accepted: true, duplicate: true, eventId: args.eventId };
    }
    const profile = await ctx.db.query("lifecycleProfiles")
      .withIndex("by_organization_source_subject", q => q
        .eq("organizationId", key.organizationId).eq("source", key.source)
        .eq("subjectId", args.subjectId)).unique();
    const contact = normalized.email
      ? await ctx.db.query("contacts").withIndex("by_organization_and_email", q => q
        .eq("organizationId", key.organizationId).eq("normalizedEmail", normalized.email)).unique()
      : null;
    const profileId = profile ? profile._id : await ctx.db.insert("lifecycleProfiles", {
      organizationId: key.organizationId, source: key.source, subjectId: args.subjectId,
      email: normalized.email, name: normalized.name, contactId: contact?._id,
      firstSeenAt: now, lastSeenAt: now,
    });
    if (profile) {
      await ctx.db.patch(profile._id, {
        email: normalized.email ?? profile.email,
        name: normalized.name ?? profile.name,
        contactId: normalized.email ? contact?._id : profile.contactId,
        lastSeenAt: now,
      });
    }
    await ctx.db.insert("lifecycleEvents", {
      organizationId: key.organizationId, integrationId: key._id, profileId,
      source: key.source, environment: key.environment,
      eventId: args.eventId, type: args.type, propertiesJson: normalized.propertiesJson,
      occurredAt: args.occurredAt, receivedAt: now,
    });
    await ctx.db.insert("lifecycleIngressAudit", {
      organizationId: key.organizationId, integrationId: key._id,
      eventId: args.eventId, outcome: "accepted", createdAt: now,
    });
    return { accepted: true, duplicate: false, eventId: args.eventId };
  },
});
