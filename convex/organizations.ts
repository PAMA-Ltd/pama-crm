import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireCrmUser,
  requireOrganizationAdmin,
  requireOrganizationMember,
  requireOrganizationOwner,
} from "./authz";
import { organizationRoleValidator } from "./workspaceModels";

const organizationResult = v.object({
  _id: v.id("organizations"),
  _creationTime: v.number(),
  name: v.string(),
  slug: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  planName: v.string(),
  billingEmail: v.optional(v.string()),
  role: organizationRoleValidator,
});

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const listMine = query({
  args: {},
  returns: v.array(organizationResult),
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userSubject", identity.subject))
      .take(100);

    const result = [];
    for (const membership of memberships) {
      const organization = await ctx.db.get(membership.organizationId);
      if (organization) {
        result.push({
          _id: organization._id,
          _creationTime: organization._creationTime,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          planName: organization.planName,
          billingEmail: organization.billingEmail,
          role: membership.role,
        });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { organizationId: v.id("organizations") },
  returns: v.union(organizationResult, v.null()),
  handler: async (ctx, args) => {
    const { member } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) return null;

    return {
      _id: organization._id,
      _creationTime: organization._creationTime,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      planName: organization.planName,
      billingEmail: organization.billingEmail,
      role: member.role,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Organization name is required.");

    const slug = slugify(args.slug || name);
    if (!slug) throw new Error("A valid organization slug is required.");

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error("That organization slug is already in use.");

    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      createdBy: identity.subject,
      createdAt: Date.now(),
      status: "active",
      planName: "Internal",
      billingEmail:
        args.billingEmail?.trim().toLocaleLowerCase() ||
        identity.email?.trim().toLocaleLowerCase() ||
        undefined,
    });

    await ctx.db.insert("organizationMembers", {
      organizationId,
      userSubject: identity.subject,
      email: identity.email?.trim().toLocaleLowerCase() || undefined,
      name: identity.name || undefined,
      role: "owner",
      joinedAt: Date.now(),
    });

    await ctx.db.insert("pipelines", {
      organizationId,
      name: "Sales",
      slug: "sales",
      description: "Default sales pipeline",
      isDefault: true,
      createdAt: Date.now(),
    });

    return organizationId;
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    billingEmail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization) throw new Error("Organization not found.");

    const name = args.name.trim();
    const slug = slugify(args.slug);
    if (!name || !slug) throw new Error("Name and slug are required.");

    const conflict = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (conflict && conflict._id !== args.organizationId) {
      throw new Error("That organization slug is already in use.");
    }

    await ctx.db.patch(args.organizationId, {
      name,
      slug,
      billingEmail:
        args.billingEmail?.trim().toLocaleLowerCase() || undefined,
    });
    return null;
  },
});

export const archive = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationOwner(ctx, args.organizationId);
    await ctx.db.patch(args.organizationId, { status: "archived" });
    return null;
  },
});

export const listMembers = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("organizationMembers"),
      userSubject: v.string(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      role: organizationRoleValidator,
      teamId: v.optional(v.id("teams")),
      joinedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const members = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(250);

    // Return exactly the declared result shape; raw Convex documents also contain
    // _creationTime and organizationId, which strict return validation rejects.
    return members.map((member) => ({
      _id: member._id,
      userSubject: member.userSubject,
      email: member.email,
      name: member.name,
      avatarUrl: member.avatarUrl,
      role: member.role,
      teamId: member.teamId,
      joinedAt: member.joinedAt,
    }));
  },
});

export const inviteMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role: organizationRoleValidator,
  },
  returns: v.id("organizationInvites"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationAdmin(
      ctx,
      args.organizationId,
    );
    const email = args.email.trim().toLocaleLowerCase();
    if (!email.includes("@")) throw new Error("Enter a valid email address.");

    const existing = await ctx.db
      .query("organizationInvites")
      .withIndex("by_organization_and_email", (q) =>
        q.eq("organizationId", args.organizationId).eq("email", email),
      )
      .take(20);

    const pending = existing.find((invite) => invite.status === "pending");
    if (pending) throw new Error("This email already has a pending invite.");

    return await ctx.db.insert("organizationInvites", {
      organizationId: args.organizationId,
      email,
      role: args.role,
      status: "pending",
      createdBy: identity.subject,
      createdAt: Date.now(),
      expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    });
  },
});

export const listPendingInvites = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizationInvites"),
      organizationId: v.id("organizations"),
      organizationName: v.string(),
      email: v.string(),
      role: organizationRoleValidator,
      expiresAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await requireCrmUser(ctx);
    const email = identity.email?.trim().toLocaleLowerCase();
    if (!email) return [];

    const invites = await ctx.db
      .query("organizationInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(100);

    const result = [];
    for (const invite of invites) {
      if (invite.status !== "pending" || invite.expiresAt < Date.now()) continue;
      const organization = await ctx.db.get(invite.organizationId);
      if (!organization) continue;
      result.push({
        _id: invite._id,
        organizationId: invite.organizationId,
        organizationName: organization.name,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      });
    }
    return result;
  },
});

export const acceptInvite = mutation({
  args: { inviteId: v.id("organizationInvites") },
  returns: v.id("organizationMembers"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") {
      throw new Error("Invite is no longer available.");
    }
    if (invite.expiresAt < Date.now()) throw new Error("Invite has expired.");

    const email = identity.email?.trim().toLocaleLowerCase();
    if (!email || email !== invite.email) {
      throw new Error("Sign in with the invited email address.");
    }

    const existing = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", invite.organizationId)
          .eq("userSubject", identity.subject),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(invite._id, { status: "accepted" });
      return existing._id;
    }

    const memberId = await ctx.db.insert("organizationMembers", {
      organizationId: invite.organizationId,
      userSubject: identity.subject,
      email,
      name: identity.name || undefined,
      role: invite.role,
      joinedAt: Date.now(),
    });
    await ctx.db.patch(invite._id, { status: "accepted" });
    return memberId;
  },
});

export const setMemberRole = mutation({
  args: {
    organizationId: v.id("organizations"),
    memberId: v.id("organizationMembers"),
    role: organizationRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationOwner(ctx, args.organizationId);
    const member = await ctx.db.get(args.memberId);
    if (!member || member.organizationId !== args.organizationId) {
      throw new Error("Member not found.");
    }
    await ctx.db.patch(args.memberId, { role: args.role });
    return null;
  },
});

export const claimLegacyData = mutation({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    companies: v.number(),
    contacts: v.number(),
    deals: v.number(),
    activities: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOrganizationOwner(ctx, args.organizationId);

    const companies = await ctx.db.query("companies").take(500);
    const contacts = await ctx.db.query("contacts").take(500);
    const deals = await ctx.db.query("deals").take(500);
    const activities = await ctx.db.query("activities").take(500);

    let companyCount = 0;
    let contactCount = 0;
    let dealCount = 0;
    let activityCount = 0;

    for (const company of companies) {
      if (!company.organizationId) {
        await ctx.db.patch(company._id, { organizationId: args.organizationId });
        companyCount += 1;
      }
    }
    for (const contact of contacts) {
      if (!contact.organizationId) {
        await ctx.db.patch(contact._id, { organizationId: args.organizationId });
        contactCount += 1;
      }
    }
    for (const deal of deals) {
      if (!deal.organizationId) {
        await ctx.db.patch(deal._id, { organizationId: args.organizationId });
        dealCount += 1;
      }
    }
    for (const activity of activities) {
      if (!activity.organizationId) {
        await ctx.db.patch(activity._id, {
          organizationId: args.organizationId,
          source: activity.source ?? "human",
        });
        activityCount += 1;
      }
    }

    return {
      companies: companyCount,
      contacts: contactCount,
      deals: dealCount,
      activities: activityCount,
    };
  },
});
