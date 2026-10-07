import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMcpToken } from "./mcpAuth";
import {
  activityTypeValidator,
  contactStatusValidator,
  dealStageValidator,
} from "./crmModels";
import { companyTagValidator, lastInteractionValidator } from "./companyModel";
import {
  organizationRoleValidator,
  sequenceStatusValidator,
  sequenceStepValidator,
} from "./workspaceModels";

type DataContext = QueryCtx | MutationCtx;

const STAGE_PROBABILITY = {
  Lead: 10,
  Qualified: 25,
  Proposal: 50,
  Negotiation: 75,
  Won: 100,
  Lost: 0,
} as const;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function resolveAccess(
  ctx: DataContext,
  tokenHash: string,
  organizationSlug: string,
) {
  const token = await requireMcpToken(ctx, tokenHash);
  const slug = normalize(organizationSlug);
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();

  if (!organization) throw new Error("Organization not found.");
  if (organization.status !== "active") {
    throw new Error("Organization is archived.");
  }

  const member = await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_and_user", (q) =>
      q
        .eq("organizationId", organization._id)
        .eq("userSubject", token.userSubject),
    )
    .unique();

  if (!member) {
    throw new Error("This MCP token cannot access that organization.");
  }

  return { token, organization, member };
}

async function requireAdmin(
  ctx: DataContext,
  tokenHash: string,
  organizationSlug: string,
) {
  const access = await resolveAccess(ctx, tokenHash, organizationSlug);
  if (access.member.role === "member") {
    throw new Error("Organization admin access is required.");
  }
  return access;
}

async function refreshCompanyMetrics(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  companyId: Id<"companies">,
) {
  const deals = await ctx.db
    .query("deals")
    .withIndex("by_organization_and_company", (q) =>
      q.eq("organizationId", organizationId).eq("companyId", companyId),
    )
    .take(500);
  const open = deals.filter(
    (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
  );
  const value = open.reduce((sum, deal) => sum + deal.amount, 0);
  const weighted = open.reduce(
    (sum, deal) => sum + deal.amount * deal.probability,
    0,
  );

  await ctx.db.patch(companyId, {
    openDeals: open.length,
    pipelineValue: Math.round(value),
    winProbability: value > 0 ? Math.round(weighted / value) : 0,
  });
}

async function ensureCompany(
  ctx: DataContext,
  organizationId: Id<"organizations">,
  companyId: Id<"companies">,
) {
  const company = await ctx.db.get(companyId);
  if (!company || company.organizationId !== organizationId) {
    throw new Error("Company not found.");
  }
  return company;
}

async function ensureContact(
  ctx: DataContext,
  organizationId: Id<"organizations">,
  contactId: Id<"contacts">,
) {
  const contact = await ctx.db.get(contactId);
  if (!contact || contact.organizationId !== organizationId) {
    throw new Error("Contact not found.");
  }
  return contact;
}

async function ensureDeal(
  ctx: DataContext,
  organizationId: Id<"organizations">,
  dealId: Id<"deals">,
) {
  const deal = await ctx.db.get(dealId);
  if (!deal || deal.organizationId !== organizationId) {
    throw new Error("Deal not found.");
  }
  return deal;
}

export const authenticate = query({
  args: { tokenHash: v.string() },
  returns: v.object({
    userSubject: v.string(),
    tokenPrefix: v.string(),
    organizations: v.array(
      v.object({
        id: v.id("organizations"),
        name: v.string(),
        slug: v.string(),
        role: organizationRoleValidator,
        status: v.union(v.literal("active"), v.literal("archived")),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const token = await requireMcpToken(ctx, args.tokenHash);
    const memberships = await ctx.db
      .query("organizationMembers")
      .withIndex("by_user", (q) => q.eq("userSubject", token.userSubject))
      .take(100);

    const organizations = [];
    for (const membership of memberships) {
      const organization = await ctx.db.get(membership.organizationId);
      if (!organization) continue;
      organizations.push({
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        role: membership.role,
        status: organization.status,
      });
    }

    return {
      userSubject: token.userSubject,
      tokenPrefix: token.tokenPrefix,
      organizations,
    };
  },
});

export const organizationSummary = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization, member } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const [companies, contacts, deals, activities, members, pipelines] =
      await Promise.all([
        ctx.db
          .query("companies")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(500),
        ctx.db
          .query("contacts")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(500),
        ctx.db
          .query("deals")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(500),
        ctx.db
          .query("activities")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(500),
        ctx.db
          .query("organizationMembers")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(250),
        ctx.db
          .query("pipelines")
          .withIndex("by_organization", (q) =>
            q.eq("organizationId", organization._id),
          )
          .take(100),
      ]);

    const openDeals = deals.filter(
      (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
    );
    const wonDeals = deals.filter((deal) => deal.stage === "Won");
    const openPipeline = openDeals.reduce((sum, deal) => sum + deal.amount, 0);
    const weightedForecast = openDeals.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    );
    const now = Date.now();
    const overdueActivities = activities.filter(
      (activity) =>
        activity.dueAt && !activity.completedAt && activity.dueAt < now,
    ).length;

    return {
      organization: {
        id: organization._id,
        name: organization.name,
        slug: organization.slug,
        role: member.role,
      },
      counts: {
        companies: companies.length,
        contacts: contacts.length,
        deals: deals.length,
        openDeals: openDeals.length,
        activities: activities.length,
        overdueActivities,
        members: members.length,
        pipelines: pipelines.length,
      },
      financials: {
        openPipeline,
        weightedForecast: Math.round(weightedForecast),
        wonRevenue: wonDeals.reduce((sum, deal) => sum + deal.amount, 0),
      },
    };
  },
});

export const searchCompanies = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const rows = await ctx.db
      .query("companies")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(500);
    const search = normalize(args.search ?? "");
    return rows
      .filter((company) => {
        if (!search) return true;
        return [
          company.name,
          company.owner,
          ...company.tags,
          company.lastInteraction.label,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      })
      .slice(0, Math.min(args.limit ?? 50, 200))
      .map((company) => ({
        id: company._id,
        name: company.name,
        owner: company.owner,
        ownerSubject: company.ownerSubject,
        tags: company.tags,
        openDeals: company.openDeals,
        pipelineValue: company.pipelineValue,
        winProbability: company.winProbability,
        lastInteraction: company.lastInteraction,
      }));
  },
});

export const createCompany = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    name: v.string(),
    tags: v.array(companyTagValidator),
    ownerSubject: v.optional(v.string()),
    lastInteraction: v.optional(lastInteractionValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Company name is required.");
    const normalizedName = normalize(name);
    const duplicate = await ctx.db
      .query("companies")
      .withIndex("by_organization_and_normalized_name", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("normalizedName", normalizedName),
      )
      .unique();
    if (duplicate) throw new Error("A company with this name already exists.");

    const ownerSubject = args.ownerSubject ?? token.userSubject;
    const ownerMember = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("userSubject", ownerSubject),
      )
      .unique();
    if (!ownerMember) {
      throw new Error("Selected owner is not a member of this organization.");
    }

    const id = await ctx.db.insert("companies", {
      organizationId: organization._id,
      name,
      normalizedName,
      createdBy: token.userSubject,
      ownerSubject,
      owner: ownerMember.name || ownerMember.email || "CRM member",
      tags: args.tags,
      openDeals: 0,
      pipelineValue: 0,
      winProbability: 0,
      trend: Array(14).fill(0),
      lastInteraction:
        args.lastInteraction ?? {
          date: new Date().toISOString().slice(0, 10),
          label: "Created via MCP",
        },
    });

    return { created: true, companyId: id, name };
  },
});

export const updateCompany = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    tags: v.optional(v.array(companyTagValidator)),
    ownerSubject: v.optional(v.string()),
    lastInteraction: v.optional(lastInteractionValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    await ensureCompany(ctx, organization._id, args.companyId);
    const patch: {
      name?: string;
      normalizedName?: string;
      tags?: NonNullable<typeof args.tags>;
      ownerSubject?: string;
      owner?: string;
      lastInteraction?: { date: string; label: string };
    } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Company name cannot be empty.");
      const normalizedName = normalize(name);
      const duplicate = await ctx.db
        .query("companies")
        .withIndex("by_organization_and_normalized_name", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("normalizedName", normalizedName),
        )
        .unique();
      if (duplicate && duplicate._id !== args.companyId) {
        throw new Error("A company with this name already exists.");
      }
      patch.name = name;
      patch.normalizedName = normalizedName;
    }
    if (args.tags) patch.tags = args.tags;
    if (args.lastInteraction) patch.lastInteraction = args.lastInteraction;
    if (args.ownerSubject) {
      const member = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organization_and_user", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("userSubject", args.ownerSubject!),
        )
        .unique();
      if (!member) throw new Error("Selected owner is not a member.");
      patch.ownerSubject = args.ownerSubject;
      patch.owner = member.name || member.email || "CRM member";
    }

    await ctx.db.patch(args.companyId, patch);
    return {
      updated: true,
      companyId: args.companyId,
      changed: Object.keys(patch),
    };
  },
});

export const deleteCompany = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    companyId: v.id("companies"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    await ensureCompany(ctx, organization._id, args.companyId);

    const [contact, deal, activity] = await Promise.all([
      ctx.db
        .query("contacts")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("companyId", args.companyId),
        )
        .first(),
      ctx.db
        .query("deals")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("companyId", args.companyId),
        )
        .first(),
      ctx.db
        .query("activities")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("companyId", args.companyId),
        )
        .first(),
    ]);
    if (contact || deal || activity) {
      throw new Error(
        "Remove or reassign linked contacts, deals and activities first.",
      );
    }

    await ctx.db.delete(args.companyId);
    return { deleted: true, companyId: args.companyId };
  },
});

export const importCompanies = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    rows: v.array(
      v.object({
        name: v.string(),
        tags: v.array(companyTagValidator),
      }),
    ),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    if (args.rows.length > 500) {
      throw new Error("Import a maximum of 500 companies at a time.");
    }

    const member = await ctx.db
      .query("organizationMembers")
      .withIndex("by_organization_and_user", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("userSubject", token.userSubject),
      )
      .unique();
    const owner = member?.name || member?.email || "CRM member";
    let created = 0;
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let index = 0; index < args.rows.length; index += 1) {
      const row = args.rows[index];
      const name = row.name.trim();
      if (!name) {
        skipped.push({ row: index + 1, reason: "Missing company name." });
        continue;
      }
      const normalizedName = normalize(name);
      const duplicate = await ctx.db
        .query("companies")
        .withIndex("by_organization_and_normalized_name", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("normalizedName", normalizedName),
        )
        .unique();
      if (duplicate) {
        skipped.push({ row: index + 1, reason: "Duplicate company name." });
        continue;
      }
      await ctx.db.insert("companies", {
        organizationId: organization._id,
        name,
        normalizedName,
        createdBy: token.userSubject,
        ownerSubject: token.userSubject,
        owner,
        tags: row.tags,
        openDeals: 0,
        pipelineValue: 0,
        winProbability: 0,
        trend: Array(14).fill(0),
        lastInteraction: {
          date: new Date().toISOString().slice(0, 10),
          label: "Imported via MCP",
        },
      });
      created += 1;
    }

    return { created, skippedCount: skipped.length, skipped };
  },
});

export const searchContacts = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    search: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    status: v.optional(contactStatusValidator),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const rows = await ctx.db
      .query("contacts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(500);
    const search = normalize(args.search ?? "");
    return rows
      .filter((contact) => {
        if (args.companyId && contact.companyId !== args.companyId) return false;
        if (args.status && contact.status !== args.status) return false;
        if (!search) return true;
        return [
          contact.firstName,
          contact.lastName,
          contact.email ?? "",
          contact.phone ?? "",
          contact.title ?? "",
          contact.status,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      })
      .slice(0, Math.min(args.limit ?? 50, 200))
      .map((contact) => ({
        id: contact._id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        companyId: contact.companyId,
        status: contact.status,
        notes: contact.notes,
      }));
  },
});

export const createContact = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName && !lastName) throw new Error("A contact name is required.");
    if (args.companyId) {
      await ensureCompany(ctx, organization._id, args.companyId);
    }
    const email = args.email?.trim().toLocaleLowerCase() || undefined;
    if (email) {
      const duplicate = await ctx.db
        .query("contacts")
        .withIndex("by_organization_and_email", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("normalizedEmail", email),
        )
        .unique();
      if (duplicate) throw new Error("A contact with this email already exists.");
    }

    const id = await ctx.db.insert("contacts", {
      organizationId: organization._id,
      firstName,
      lastName,
      normalizedName: normalize(`${firstName} ${lastName}`),
      email,
      normalizedEmail: email,
      phone: args.phone?.trim() || undefined,
      title: args.title?.trim() || undefined,
      companyId: args.companyId,
      ownerSubject: token.userSubject,
      status: args.status,
      notes: args.notes?.trim() || undefined,
      createdBy: token.userSubject,
      updatedAt: Date.now(),
    });
    return { created: true, contactId: id, name: `${firstName} ${lastName}`.trim() };
  },
});

export const updateContact = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    contactId: v.id("contacts"),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.union(v.id("companies"), v.null())),
    status: v.optional(contactStatusValidator),
    notes: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const contact = await ensureContact(ctx, organization._id, args.contactId);
    const patch: {
      firstName?: string;
      lastName?: string;
      normalizedName?: string;
      email?: string;
      normalizedEmail?: string;
      phone?: string;
      title?: string;
      companyId?: Id<"companies"> | undefined;
      status?: typeof contact.status;
      notes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    const firstName = args.firstName?.trim() ?? contact.firstName;
    const lastName = args.lastName?.trim() ?? contact.lastName;
    if (!firstName && !lastName) throw new Error("A contact name is required.");
    if (args.firstName !== undefined) patch.firstName = firstName;
    if (args.lastName !== undefined) patch.lastName = lastName;
    if (args.firstName !== undefined || args.lastName !== undefined) {
      patch.normalizedName = normalize(`${firstName} ${lastName}`);
    }
    if (args.email !== undefined) {
      const email = args.email.trim().toLocaleLowerCase();
      if (email) {
        const duplicate = await ctx.db
          .query("contacts")
          .withIndex("by_organization_and_email", (q) =>
            q
              .eq("organizationId", organization._id)
              .eq("normalizedEmail", email),
          )
          .unique();
        if (duplicate && duplicate._id !== args.contactId) {
          throw new Error("A contact with this email already exists.");
        }
      }
      patch.email = email || undefined;
      patch.normalizedEmail = email || undefined;
    }
    if (args.phone !== undefined) patch.phone = args.phone.trim() || undefined;
    if (args.title !== undefined) patch.title = args.title.trim() || undefined;
    if (args.companyId !== undefined) {
      if (args.companyId) {
        await ensureCompany(ctx, organization._id, args.companyId);
        patch.companyId = args.companyId;
      } else {
        patch.companyId = undefined;
      }
    }
    if (args.status) patch.status = args.status;
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    await ctx.db.patch(args.contactId, patch);
    return { updated: true, contactId: args.contactId, changed: Object.keys(patch) };
  },
});

export const deleteContact = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    contactId: v.id("contacts"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    await ensureContact(ctx, organization._id, args.contactId);
    const deal = await ctx.db
      .query("deals")
      .withIndex("by_organization_and_contact", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("contactId", args.contactId),
      )
      .first();
    if (deal) throw new Error("Remove this contact from linked deals first.");

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization_and_contact", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("contactId", args.contactId),
      )
      .take(500);
    for (const activity of activities) {
      await ctx.db.patch(activity._id, { contactId: undefined });
    }
    await ctx.db.delete(args.contactId);
    return { deleted: true, contactId: args.contactId };
  },
});

export const searchDeals = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    search: v.optional(v.string()),
    stage: v.optional(dealStageValidator),
    companyId: v.optional(v.id("companies")),
    pipelineId: v.optional(v.id("pipelines")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(500);
    const search = normalize(args.search ?? "");
    return rows
      .filter((deal) => {
        if (args.stage && deal.stage !== args.stage) return false;
        if (args.companyId && deal.companyId !== args.companyId) return false;
        if (args.pipelineId && deal.pipelineId !== args.pipelineId) return false;
        if (!search) return true;
        return [deal.name, deal.stage, deal.notes ?? ""]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search);
      })
      .slice(0, Math.min(args.limit ?? 50, 200))
      .map((deal) => ({
        id: deal._id,
        name: deal.name,
        companyId: deal.companyId,
        contactId: deal.contactId,
        pipelineId: deal.pipelineId,
        amount: deal.amount,
        stage: deal.stage,
        probability: deal.probability,
        expectedCloseDate: deal.expectedCloseDate,
        notes: deal.notes,
      }));
  },
});

export const createDeal = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    name: v.string(),
    companyId: v.id("companies"),
    contactId: v.optional(v.id("contacts")),
    pipelineId: v.optional(v.id("pipelines")),
    amount: v.number(),
    stage: dealStageValidator,
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Deal name is required.");
    if (!Number.isFinite(args.amount) || args.amount < 0) {
      throw new Error("Deal amount must be non-negative.");
    }
    await ensureCompany(ctx, organization._id, args.companyId);
    if (args.contactId) {
      const contact = await ensureContact(ctx, organization._id, args.contactId);
      if (contact.companyId && contact.companyId !== args.companyId) {
        throw new Error("Selected contact belongs to another company.");
      }
    }
    if (args.pipelineId) {
      const pipeline = await ctx.db.get(args.pipelineId);
      if (!pipeline || pipeline.organizationId !== organization._id) {
        throw new Error("Pipeline not found.");
      }
    }

    const id = await ctx.db.insert("deals", {
      organizationId: organization._id,
      name,
      companyId: args.companyId,
      contactId: args.contactId,
      pipelineId: args.pipelineId,
      amount: Math.round(args.amount),
      stage: args.stage,
      probability: STAGE_PROBABILITY[args.stage],
      expectedCloseDate: args.expectedCloseDate?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      createdBy: token.userSubject,
      updatedAt: Date.now(),
    });
    await refreshCompanyMetrics(ctx, organization._id, args.companyId);
    return {
      created: true,
      dealId: id,
      name,
      stage: args.stage,
      amount: Math.round(args.amount),
    };
  },
});

export const updateDeal = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    dealId: v.id("deals"),
    name: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.union(v.id("contacts"), v.null())),
    pipelineId: v.optional(v.union(v.id("pipelines"), v.null())),
    amount: v.optional(v.number()),
    stage: v.optional(dealStageValidator),
    expectedCloseDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const deal = await ensureDeal(ctx, organization._id, args.dealId);
    const nextCompanyId = args.companyId ?? deal.companyId;
    await ensureCompany(ctx, organization._id, nextCompanyId);

    if (args.contactId) {
      const contact = await ensureContact(ctx, organization._id, args.contactId);
      if (contact.companyId && contact.companyId !== nextCompanyId) {
        throw new Error("Selected contact belongs to another company.");
      }
    }
    if (args.pipelineId) {
      const pipeline = await ctx.db.get(args.pipelineId);
      if (!pipeline || pipeline.organizationId !== organization._id) {
        throw new Error("Pipeline not found.");
      }
    }
    if (args.amount !== undefined && (!Number.isFinite(args.amount) || args.amount < 0)) {
      throw new Error("Deal amount must be non-negative.");
    }

    const patch: {
      name?: string;
      companyId?: Id<"companies">;
      contactId?: Id<"contacts"> | undefined;
      pipelineId?: Id<"pipelines"> | undefined;
      amount?: number;
      stage?: typeof deal.stage;
      probability?: number;
      expectedCloseDate?: string;
      notes?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Deal name cannot be empty.");
      patch.name = name;
    }
    if (args.companyId) patch.companyId = args.companyId;
    if (args.contactId !== undefined) patch.contactId = args.contactId ?? undefined;
    if (args.pipelineId !== undefined) patch.pipelineId = args.pipelineId ?? undefined;
    if (args.amount !== undefined) patch.amount = Math.round(args.amount);
    if (args.stage) {
      patch.stage = args.stage;
      patch.probability = STAGE_PROBABILITY[args.stage];
    }
    if (args.expectedCloseDate !== undefined) {
      patch.expectedCloseDate = args.expectedCloseDate.trim() || undefined;
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    await ctx.db.patch(args.dealId, patch);

    if (args.stage && args.stage !== deal.stage) {
      await ctx.db.insert("activities", {
        organizationId: organization._id,
        type: "Note",
        source: "mcp",
        subject: `Deal moved to ${args.stage}`,
        description: patch.name ?? deal.name,
        companyId: nextCompanyId,
        contactId:
          args.contactId === null
            ? undefined
            : args.contactId ?? deal.contactId,
        dealId: args.dealId,
        createdBy: token.userSubject,
        updatedAt: Date.now(),
      });
    }

    await refreshCompanyMetrics(ctx, organization._id, nextCompanyId);
    if (deal.companyId !== nextCompanyId) {
      await refreshCompanyMetrics(ctx, organization._id, deal.companyId);
    }

    return {
      updated: true,
      dealId: args.dealId,
      changed: Object.keys(patch),
    };
  },
});

export const changeDealStage = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    dealId: v.id("deals"),
    stage: dealStageValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const deal = await ensureDeal(ctx, organization._id, args.dealId);
    await ctx.db.patch(args.dealId, {
      stage: args.stage,
      probability: STAGE_PROBABILITY[args.stage],
      updatedAt: Date.now(),
    });
    await ctx.db.insert("activities", {
      organizationId: organization._id,
      type: "Note",
      source: "mcp",
      subject: `Deal moved to ${args.stage}`,
      description: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId,
      dealId: deal._id,
      createdBy: token.userSubject,
      updatedAt: Date.now(),
    });
    await refreshCompanyMetrics(ctx, organization._id, deal.companyId);
    return {
      updated: true,
      dealId: deal._id,
      previousStage: deal.stage,
      stage: args.stage,
      probability: STAGE_PROBABILITY[args.stage],
    };
  },
});

export const deleteDeal = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    dealId: v.id("deals"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const deal = await ensureDeal(ctx, organization._id, args.dealId);
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization_and_deal", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("dealId", args.dealId),
      )
      .take(500);
    for (const activity of activities) {
      await ctx.db.patch(activity._id, { dealId: undefined });
    }
    await ctx.db.delete(args.dealId);
    await refreshCompanyMetrics(ctx, organization._id, deal.companyId);
    return { deleted: true, dealId: args.dealId };
  },
});

export const listActivities = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    openOnly: v.optional(v.boolean()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const rows = await ctx.db
      .query("activities")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .order("desc")
      .take(500);
    return rows
      .filter((activity) => {
        if (args.openOnly && activity.completedAt) return false;
        if (args.companyId && activity.companyId !== args.companyId) return false;
        if (args.contactId && activity.contactId !== args.contactId) return false;
        if (args.dealId && activity.dealId !== args.dealId) return false;
        return true;
      })
      .slice(0, Math.min(args.limit ?? 100, 300))
      .map((activity) => ({
        id: activity._id,
        type: activity.type,
        source: activity.source,
        subject: activity.subject,
        description: activity.description,
        companyId: activity.companyId,
        contactId: activity.contactId,
        dealId: activity.dealId,
        dueAt: activity.dueAt,
        completedAt: activity.completedAt,
        createdAt: activity._creationTime,
      }));
  },
});

export const createActivity = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    type: activityTypeValidator,
    subject: v.string(),
    description: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    dealId: v.optional(v.id("deals")),
    dueAt: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const subject = args.subject.trim();
    if (!subject) throw new Error("Activity subject is required.");
    if (args.companyId) await ensureCompany(ctx, organization._id, args.companyId);
    if (args.contactId) await ensureContact(ctx, organization._id, args.contactId);
    if (args.dealId) await ensureDeal(ctx, organization._id, args.dealId);

    const id = await ctx.db.insert("activities", {
      organizationId: organization._id,
      type: args.type,
      source: "mcp",
      subject,
      description: args.description?.trim() || undefined,
      companyId: args.companyId,
      contactId: args.contactId,
      dealId: args.dealId,
      dueAt: args.dueAt,
      createdBy: token.userSubject,
      updatedAt: Date.now(),
    });
    return { created: true, activityId: id, subject, type: args.type };
  },
});

export const updateActivity = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    activityId: v.id("activities"),
    type: v.optional(activityTypeValidator),
    subject: v.optional(v.string()),
    description: v.optional(v.string()),
    companyId: v.optional(v.union(v.id("companies"), v.null())),
    contactId: v.optional(v.union(v.id("contacts"), v.null())),
    dealId: v.optional(v.union(v.id("deals"), v.null())),
    dueAt: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.organizationId !== organization._id) {
      throw new Error("Activity not found.");
    }

    if (args.companyId) await ensureCompany(ctx, organization._id, args.companyId);
    if (args.contactId) await ensureContact(ctx, organization._id, args.contactId);
    if (args.dealId) await ensureDeal(ctx, organization._id, args.dealId);

    const patch: {
      type?: typeof activity.type;
      subject?: string;
      description?: string;
      companyId?: Id<"companies"> | undefined;
      contactId?: Id<"contacts"> | undefined;
      dealId?: Id<"deals"> | undefined;
      dueAt?: number | undefined;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.type) patch.type = args.type;
    if (args.subject !== undefined) {
      const subject = args.subject.trim();
      if (!subject) throw new Error("Activity subject cannot be empty.");
      patch.subject = subject;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    if (args.companyId !== undefined) patch.companyId = args.companyId ?? undefined;
    if (args.contactId !== undefined) patch.contactId = args.contactId ?? undefined;
    if (args.dealId !== undefined) patch.dealId = args.dealId ?? undefined;
    if (args.dueAt !== undefined) patch.dueAt = args.dueAt ?? undefined;

    await ctx.db.patch(args.activityId, patch);
    return {
      updated: true,
      activityId: args.activityId,
      changed: Object.keys(patch),
    };
  },
});

export const completeActivity = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    activityId: v.id("activities"),
    completed: v.boolean(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.organizationId !== organization._id) {
      throw new Error("Activity not found.");
    }
    const completedAt = args.completed ? Date.now() : undefined;
    await ctx.db.patch(args.activityId, {
      completedAt,
      updatedAt: Date.now(),
    });
    return {
      updated: true,
      activityId: args.activityId,
      completed: args.completed,
      completedAt,
    };
  },
});

export const deleteActivity = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    activityId: v.id("activities"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.organizationId !== organization._id) {
      throw new Error("Activity not found.");
    }
    await ctx.db.delete(args.activityId);
    return { deleted: true, activityId: args.activityId };
  },
});

export const listPipelines = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const pipelines = await ctx.db
      .query("pipelines")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(100);

    const result = [];
    for (const pipeline of pipelines) {
      const deals = await ctx.db
        .query("deals")
        .withIndex("by_organization_and_pipeline", (q) =>
          q
            .eq("organizationId", organization._id)
            .eq("pipelineId", pipeline._id),
        )
        .take(500);
      result.push({
        id: pipeline._id,
        name: pipeline.name,
        slug: pipeline.slug,
        description: pipeline.description,
        isDefault: pipeline.isDefault,
        dealCount: deals.length,
        openValue: deals
          .filter((deal) => deal.stage !== "Won" && deal.stage !== "Lost")
          .reduce((sum, deal) => sum + deal.amount, 0),
      });
    }
    return result;
  },
});

export const createPipeline = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await requireAdmin(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Pipeline name is required.");
    const slug = slugify(name);
    const duplicate = await ctx.db
      .query("pipelines")
      .withIndex("by_organization_and_slug", (q) =>
        q.eq("organizationId", organization._id).eq("slug", slug),
      )
      .unique();
    if (duplicate) throw new Error("A pipeline with this name already exists.");
    const id = await ctx.db.insert("pipelines", {
      organizationId: organization._id,
      name,
      slug,
      description: args.description?.trim() || undefined,
      isDefault: false,
      createdAt: Date.now(),
    });
    return { created: true, pipelineId: id, name, slug };
  },
});

export const deletePipeline = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    pipelineId: v.id("pipelines"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await requireAdmin(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const pipeline = await ctx.db.get(args.pipelineId);
    if (!pipeline || pipeline.organizationId !== organization._id) {
      throw new Error("Pipeline not found.");
    }
    if (pipeline.isDefault) throw new Error("The default pipeline cannot be deleted.");
    const deal = await ctx.db
      .query("deals")
      .withIndex("by_organization_and_pipeline", (q) =>
        q
          .eq("organizationId", organization._id)
          .eq("pipelineId", args.pipelineId),
      )
      .first();
    if (deal) throw new Error("Move deals out of this pipeline first.");
    await ctx.db.delete(args.pipelineId);
    return { deleted: true, pipelineId: args.pipelineId };
  },
});

export const listPeople = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const [members, teams] = await Promise.all([
      ctx.db
        .query("organizationMembers")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .take(250),
      ctx.db
        .query("teams")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .take(100),
    ]);
    return {
      teams: teams.map((team) => ({
        id: team._id,
        name: team.name,
        slug: team.slug,
        description: team.description,
      })),
      members: members.map((member) => ({
        id: member._id,
        userSubject: member.userSubject,
        name: member.name,
        email: member.email,
        role: member.role,
        teamId: member.teamId,
      })),
    };
  },
});

export const listSequences = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const sequences = await ctx.db
      .query("emailSequences")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(100);
    const result = [];
    for (const sequence of sequences) {
      const enrollments = await ctx.db
        .query("sequenceEnrollments")
        .withIndex("by_sequence", (q) => q.eq("sequenceId", sequence._id))
        .take(500);
      result.push({
        id: sequence._id,
        name: sequence.name,
        status: sequence.status,
        steps: sequence.steps,
        enrollmentCount: enrollments.length,
      });
    }
    return result;
  },
});

export const createSequence = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    name: v.string(),
    status: sequenceStatusValidator,
    steps: v.array(sequenceStepValidator),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { token, organization } = await requireAdmin(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Sequence name is required.");
    if (!args.steps.length) throw new Error("Add at least one sequence step.");
    const now = Date.now();
    const id = await ctx.db.insert("emailSequences", {
      organizationId: organization._id,
      name,
      status: args.status,
      steps: args.steps.map((step) => ({
        delayDays: Math.max(0, Math.round(step.delayDays)),
        subject: step.subject.trim(),
        body: step.body.trim(),
      })),
      createdBy: token.userSubject,
      createdAt: now,
      updatedAt: now,
    });
    return { created: true, sequenceId: id, name, status: args.status };
  },
});

export const updateSequence = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    sequenceId: v.id("emailSequences"),
    name: v.optional(v.string()),
    status: v.optional(sequenceStatusValidator),
    steps: v.optional(v.array(sequenceStepValidator)),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await requireAdmin(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.organizationId !== organization._id) {
      throw new Error("Sequence not found.");
    }
    const patch: {
      name?: string;
      status?: typeof sequence.status;
      steps?: typeof sequence.steps;
      updatedAt: number;
    } = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Sequence name cannot be empty.");
      patch.name = name;
    }
    if (args.status) patch.status = args.status;
    if (args.steps) {
      if (!args.steps.length) throw new Error("Add at least one sequence step.");
      patch.steps = args.steps.map((step) => ({
        delayDays: Math.max(0, Math.round(step.delayDays)),
        subject: step.subject.trim(),
        body: step.body.trim(),
      }));
    }
    await ctx.db.patch(args.sequenceId, patch);
    return { updated: true, sequenceId: args.sequenceId, changed: Object.keys(patch) };
  },
});

export const deleteSequence = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    sequenceId: v.id("emailSequences"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await requireAdmin(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.organizationId !== organization._id) {
      throw new Error("Sequence not found.");
    }
    const enrollments = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence", (q) => q.eq("sequenceId", args.sequenceId))
      .take(500);
    for (const enrollment of enrollments) {
      await ctx.db.delete(enrollment._id);
    }
    await ctx.db.delete(args.sequenceId);
    return { deleted: true, sequenceId: args.sequenceId, enrollmentsRemoved: enrollments.length };
  },
});

export const enrollContact = mutation({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    sequenceId: v.id("emailSequences"),
    contactId: v.id("contacts"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.organizationId !== organization._id) {
      throw new Error("Sequence not found.");
    }
    await ensureContact(ctx, organization._id, args.contactId);
    const existing = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_and_contact", (q) =>
        q.eq("sequenceId", args.sequenceId).eq("contactId", args.contactId),
      )
      .unique();
    if (existing) throw new Error("Contact is already enrolled.");
    const now = Date.now();
    const id = await ctx.db.insert("sequenceEnrollments", {
      organizationId: organization._id,
      sequenceId: args.sequenceId,
      contactId: args.contactId,
      status: "active",
      currentStep: 0,
      nextStepAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { enrolled: true, enrollmentId: id, sequenceId: args.sequenceId, contactId: args.contactId };
  },
});

export const forecast = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(500);
    const open = deals.filter(
      (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
    );
    const won = deals.filter((deal) => deal.stage === "Won");
    const lost = deals.filter((deal) => deal.stage === "Lost");
    const openPipeline = open.reduce((sum, deal) => sum + deal.amount, 0);
    const weightedForecast = open.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    );
    const closed = won.length + lost.length;
    return {
      openPipeline,
      weightedForecast: Math.round(weightedForecast),
      wonRevenue: won.reduce((sum, deal) => sum + deal.amount, 0),
      winRate: closed ? Math.round((won.length / closed) * 100) : 0,
      openCount: open.length,
      wonCount: won.length,
    };
  },
});

export const slippingDeals = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const todayIso = new Date().toISOString().slice(0, 10);
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organization._id),
      )
      .take(500);
    return deals
      .filter(
        (deal) =>
          deal.stage !== "Won" &&
          deal.stage !== "Lost" &&
          deal.expectedCloseDate &&
          deal.expectedCloseDate < todayIso,
      )
      .map((deal) => ({
        id: deal._id,
        name: deal.name,
        companyId: deal.companyId,
        amount: deal.amount,
        stage: deal.stage,
        expectedCloseDate: deal.expectedCloseDate,
        daysLate: Math.max(
          1,
          Math.floor(
            (Date.now() - Date.parse(`${deal.expectedCloseDate}T00:00:00Z`)) /
              86_400_000,
          ),
        ),
      }))
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, Math.min(args.limit ?? 100, 250));
  },
});

export const attentionSummary = query({
  args: {
    tokenHash: v.string(),
    organizationSlug: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { organization } = await resolveAccess(
      ctx,
      args.tokenHash,
      args.organizationSlug,
    );
    const [activities, deals, companies] = await Promise.all([
      ctx.db
        .query("activities")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .take(500),
      ctx.db
        .query("deals")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .take(500),
      ctx.db
        .query("companies")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", organization._id),
        )
        .take(500),
    ]);

    const now = Date.now();
    const overdue = activities
      .filter(
        (activity) =>
          activity.dueAt && !activity.completedAt && activity.dueAt < now,
      )
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
      .slice(0, 20)
      .map((activity) => ({
        id: activity._id,
        subject: activity.subject,
        type: activity.type,
        dueAt: activity.dueAt,
        companyId: activity.companyId,
        contactId: activity.contactId,
        dealId: activity.dealId,
      }));

    const slipping = deals
      .filter(
        (deal) =>
          deal.stage !== "Won" &&
          deal.stage !== "Lost" &&
          deal.expectedCloseDate &&
          Date.parse(`${deal.expectedCloseDate}T00:00:00Z`) < now,
      )
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 20)
      .map((deal) => ({
        id: deal._id,
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage,
        expectedCloseDate: deal.expectedCloseDate,
        companyId: deal.companyId,
      }));

    const stale = companies
      .filter((company) => {
        const age = now - Date.parse(`${company.lastInteraction.date}T00:00:00Z`);
        return age > 14 * 86_400_000;
      })
      .sort((a, b) => b.pipelineValue - a.pipelineValue)
      .slice(0, 20)
      .map((company) => ({
        id: company._id,
        name: company.name,
        pipelineValue: company.pipelineValue,
        lastInteraction: company.lastInteraction,
      }));

    return {
      overdueActivities: overdue,
      slippingDeals: slipping,
      staleCompanies: stale,
    };
  },
});
