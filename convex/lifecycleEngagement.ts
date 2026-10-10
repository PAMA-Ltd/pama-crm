import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrganizationAdmin, requireOrganizationMember } from "./authz";
import { eligibleForMarketing, isEventType, isSource, isTag, matchesSegment, nextTags } from "../lib/lifecycle/engagement";

type Context = QueryCtx | MutationCtx;
type Module = "lifecycle" | "campaigns" | "automations" | "audience";
const nameField = (value: string) => {
  const name = value.trim();
  if (!name || name.length > 100) throw new Error("Name must contain 1–100 characters.");
  return name;
};
const optionalSource = (value: string | undefined) => {
  if (value && !isSource(value)) throw new Error("Invalid event source.");
  return value || undefined;
};
const optionalEventType = (value: string | undefined) => {
  if (value && !isEventType(value)) throw new Error("Invalid event type.");
  return value || undefined;
};
const optionalTag = (value: string | undefined) => {
  if (value && !isTag(value)) throw new Error("Invalid tag.");
  return value || undefined;
};
async function requireModule(ctx: Context, organizationId: Id<"organizations">, module: Module, write = false) {
  const access = write
    ? await requireOrganizationAdmin(ctx, organizationId)
    : await requireOrganizationMember(ctx, organizationId);
  const organization = await ctx.db.get(organizationId);
  if (!organization || organization.status !== "active") throw new Error("Active workspace required.");
  const settings = await ctx.db.query("organizationSettings")
    .withIndex("by_organization", q => q.eq("organizationId", organizationId)).unique();
  const hasModule = module === "audience"
    ? Boolean(settings?.enabledModules.some(value => value === "lifecycle" || value === "campaigns"))
    : Boolean(settings?.enabledModules.includes(module));
  if (!hasModule) throw new Error("Workspace module is disabled.");
  return access;
}
async function getOwnedSegment(ctx: Context, organizationId: Id<"organizations">, segmentId: Id<"lifecycleSegments">) {
  const segment = await ctx.db.get(segmentId);
  if (!segment || segment.organizationId !== organizationId) throw new Error("Segment not found.");
  return segment;
}

// Bounded preview: never silently represent the first 500 profiles as a full audience.
const PROFILE_SCAN_MAX = 500;
async function segmentPreview(ctx: Context, organizationId: Id<"organizations">, segment: {
  source?: string; lastEventType?: string; requiredTag?: string;
}) {
  const profiles = await ctx.db.query("lifecycleProfiles")
    .withIndex("by_organization_last_seen", q => q.eq("organizationId", organizationId))
    .order("desc").take(PROFILE_SCAN_MAX + 1);
  const sampled = profiles.slice(0, PROFILE_SCAN_MAX);
  const matched = sampled.filter(profile => matchesSegment(profile, segment));
  return {
    matched: matched.length,
    marketingEligible: matched.filter(eligibleForMarketing).length,
    suppressed: matched.filter(profile => !eligibleForMarketing(profile)).length,
    scanned: sampled.length,
    partial: profiles.length > PROFILE_SCAN_MAX,
  };
}

export const listSegments = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await requireModule(ctx, organizationId, "audience");
    return ctx.db.query("lifecycleSegments").withIndex("by_organization", q =>
      q.eq("organizationId", organizationId)).order("desc").take(100);
  },
});
export const createSegment = mutation({
  args: { organizationId: v.id("organizations"), name: v.string(),
    source: v.optional(v.string()), lastEventType: v.optional(v.string()),
    requiredTag: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { identity } = await requireModule(ctx, args.organizationId, "audience", true);
    const source = optionalSource(args.source);
    const lastEventType = optionalEventType(args.lastEventType);
    const requiredTag = optionalTag(args.requiredTag);
    const rows = await ctx.db.query("lifecycleSegments").withIndex("by_organization", q =>
      q.eq("organizationId", args.organizationId)).take(101);
    if (rows.length >= 100) throw new Error("Segment limit reached.");
    const now = Date.now();
    return ctx.db.insert("lifecycleSegments", {
      organizationId: args.organizationId, name: nameField(args.name),
      source, lastEventType, requiredTag, createdBy: identity.subject,
      createdAt: now, updatedAt: now,
    });
  },
});
export const updateSegment = mutation({
  args: { organizationId: v.id("organizations"), segmentId: v.id("lifecycleSegments"),
    name: v.string(), source: v.optional(v.string()), lastEventType: v.optional(v.string()),
    requiredTag: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "audience", true);
    await getOwnedSegment(ctx, args.organizationId, args.segmentId);
    await ctx.db.patch(args.segmentId, {
      name: nameField(args.name), source: optionalSource(args.source),
      lastEventType: optionalEventType(args.lastEventType),
      requiredTag: optionalTag(args.requiredTag), updatedAt: Date.now(),
    });
    return null;
  },
});
export const previewSegment = query({
  args: { organizationId: v.id("organizations"), segmentId: v.id("lifecycleSegments") },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "audience");
    const segment = await getOwnedSegment(ctx, args.organizationId, args.segmentId);
    return segmentPreview(ctx, args.organizationId, segment);
  },
});

export const listCampaigns = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await requireModule(ctx, organizationId, "campaigns");
    return ctx.db.query("lifecycleCampaigns").withIndex("by_organization", q =>
      q.eq("organizationId", organizationId)).order("desc").take(100);
  },
});
function campaignText(subject: string, body: string) {
  if (!subject.trim() || subject.length > 180) throw new Error("Subject must contain 1–180 characters.");
  if (!body.trim() || body.length > 12000) throw new Error("Campaign body must contain 1–12000 characters.");
  return { subject: subject.trim(), body: body.trim() };
}
export const createCampaign = mutation({
  args: { organizationId: v.id("organizations"), segmentId: v.id("lifecycleSegments"),
    name: v.string(), subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const { identity } = await requireModule(ctx, args.organizationId, "campaigns", true);
    await getOwnedSegment(ctx, args.organizationId, args.segmentId);
    const rows = await ctx.db.query("lifecycleCampaigns").withIndex("by_organization", q =>
      q.eq("organizationId", args.organizationId)).take(101);
    if (rows.length >= 100) throw new Error("Campaign limit reached.");
    const now = Date.now();
    return ctx.db.insert("lifecycleCampaigns", {
      organizationId: args.organizationId, segmentId: args.segmentId,
      name: nameField(args.name), ...campaignText(args.subject, args.body),
      status: "draft", createdBy: identity.subject, createdAt: now, updatedAt: now,
    });
  },
});
export const updateCampaign = mutation({
  args: { organizationId: v.id("organizations"), campaignId: v.id("lifecycleCampaigns"),
    segmentId: v.id("lifecycleSegments"), name: v.string(),
    subject: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "campaigns", true);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.organizationId !== args.organizationId) throw new Error("Campaign not found.");
    if (campaign.status !== "draft") throw new Error("Archived campaigns cannot be edited.");
    await getOwnedSegment(ctx, args.organizationId, args.segmentId);
    await ctx.db.patch(args.campaignId, {
      segmentId: args.segmentId, name: nameField(args.name),
      ...campaignText(args.subject, args.body), updatedAt: Date.now(),
    });
    return null;
  },
});
export const archiveCampaign = mutation({
  args: { organizationId: v.id("organizations"), campaignId: v.id("lifecycleCampaigns") },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "campaigns", true);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.organizationId !== args.organizationId) throw new Error("Campaign not found.");
    if (campaign.status !== "archived") await ctx.db.patch(args.campaignId, {
      status: "archived", updatedAt: Date.now(),
    });
    return null;
  },
});
export const previewCampaign = query({
  args: { organizationId: v.id("organizations"), campaignId: v.id("lifecycleCampaigns") },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "campaigns");
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.organizationId !== args.organizationId) throw new Error("Campaign not found.");
    const segment = await getOwnedSegment(ctx, args.organizationId, campaign.segmentId);
    return { ...await segmentPreview(ctx, args.organizationId, segment), dispatchEnabled: false as const };
  },
});

export const listAutomations = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await requireModule(ctx, organizationId, "automations");
    return ctx.db.query("lifecycleAutomations").withIndex("by_organization", q =>
      q.eq("organizationId", organizationId)).order("desc").take(25);
  },
});
export const createAutomation = mutation({
  args: { organizationId: v.id("organizations"), name: v.string(),
    eventType: v.string(), source: v.optional(v.string()), tag: v.string() },
  handler: async (ctx, args) => {
    const { identity } = await requireModule(ctx, args.organizationId, "automations", true);
    if (!isEventType(args.eventType)) throw new Error("Invalid trigger event type.");
    if (!isTag(args.tag)) throw new Error("Invalid tag.");
    const rows = await ctx.db.query("lifecycleAutomations").withIndex("by_organization", q =>
      q.eq("organizationId", args.organizationId)).take(26);
    if (rows.length >= 25) throw new Error("Automation limit reached.");
    const now = Date.now();
    return ctx.db.insert("lifecycleAutomations", {
      organizationId: args.organizationId, name: nameField(args.name),
      eventType: args.eventType, source: optionalSource(args.source), tag: args.tag,
      status: "draft", createdBy: identity.subject, createdAt: now, updatedAt: now,
    });
  },
});
export const setAutomationStatus = mutation({
  args: { organizationId: v.id("organizations"), automationId: v.id("lifecycleAutomations"),
    status: v.union(v.literal("active"), v.literal("paused")) },
  handler: async (ctx, args) => {
    await requireModule(ctx, args.organizationId, "automations", true);
    const rule = await ctx.db.get(args.automationId);
    if (!rule || rule.organizationId !== args.organizationId) throw new Error("Automation not found.");
    await ctx.db.patch(args.automationId, { status: args.status, updatedAt: Date.now() });
    return null;
  },
});
export const listAutomationRuns = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, { organizationId }) => {
    await requireModule(ctx, organizationId, "automations");
    return ctx.db.query("lifecycleAutomationRuns").withIndex("by_organization_created", q =>
      q.eq("organizationId", organizationId)).order("desc").take(50);
  },
});

/** Invoked from the already authenticated ingestion mutation. No public endpoint. */
export async function applyTagAutomations(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  event: { profileId: Id<"lifecycleProfiles">; source: string; type: string; eventId: string; occurredAt: number },
) {
  const settings = await ctx.db.query("organizationSettings")
    .withIndex("by_organization", q => q.eq("organizationId", organizationId)).unique();
  if (!settings?.enabledModules.includes("automations")) return;
  const rules = await ctx.db.query("lifecycleAutomations").withIndex("by_organization", q =>
    q.eq("organizationId", organizationId)).take(26);
  if (rules.length > 25) throw new Error("Automation limit exceeded.");
  const relevant = rules.filter(rule => rule.status === "active" &&
    rule.eventType === event.type && (!rule.source || rule.source === event.source));
  if (relevant.length === 0) return;
  const profile = await ctx.db.get(event.profileId);
  if (!profile || profile.organizationId !== organizationId) throw new Error("Profile unavailable.");
  let tags = profile.tags ?? [];
  for (const rule of relevant) {
    const had = tags.includes(rule.tag);
    const atLimit = !had && tags.length >= 20;
    if (!had && !atLimit) tags = nextTags(tags, rule.tag);
    await ctx.db.insert("lifecycleAutomationRuns", {
      organizationId, automationId: rule._id, profileId: event.profileId,
      eventId: event.eventId, outcome: atLimit ? "skipped_limit" : had ? "already_tagged" : "tagged",
      createdAt: Date.now(),
    });
  }
  if (tags.length !== (profile.tags ?? []).length) await ctx.db.patch(event.profileId, { tags });
}
