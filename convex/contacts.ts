import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrganizationMember,
  getOrganizationMember,
} from "./authz";
import {
  contactResultValidator,
  contactStatusValidator,
} from "./crmModels";

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 500;

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function normalizedName(firstName: string, lastName: string) {
  return `${firstName.trim()} ${lastName.trim()}`.trim().toLocaleLowerCase();
}

async function ensureCompany(
  ctx: Parameters<typeof getOrganizationMember>[0],
  organizationId: Parameters<typeof requireOrganizationMember>[1],
  companyId?: any,
) {
  if (!companyId) return;
  const company = await ctx.db.get(companyId);
  if (!company || company.organizationId !== organizationId) {
    throw new Error("Company not found.");
  }
}

export const list = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(contactResultValidator),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(limit);

    return contacts.map((contact) => ({
      _id: contact._id,
      _creationTime: contact._creationTime,
      organizationId: contact.organizationId,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      companyId: contact.companyId,
      ownerSubject: contact.ownerSubject,
      status: contact.status,
      notes: contact.notes,
      updatedAt: contact.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    ownerSubject: v.optional(v.string()),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName && !lastName) throw new Error("A contact name is required.");

    await ensureCompany(ctx, args.organizationId, args.companyId);

    const ownerSubject = args.ownerSubject || identity.subject;
    if (
      !(await getOrganizationMember(
        ctx,
        args.organizationId,
        ownerSubject,
      ))
    ) {
      throw new Error("Selected owner is not a member of this organization.");
    }

    const email = cleanOptional(args.email)?.toLocaleLowerCase();
    if (email) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_organization_and_email", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("normalizedEmail", email),
        )
        .unique();
      if (existing) throw new Error("A contact with this email already exists.");
    }

    return await ctx.db.insert("contacts", {
      organizationId: args.organizationId,
      firstName,
      lastName,
      normalizedName: normalizedName(firstName, lastName),
      email,
      normalizedEmail: email,
      phone: cleanOptional(args.phone),
      title: cleanOptional(args.title),
      companyId: args.companyId,
      ownerSubject,
      status: args.status,
      notes: cleanOptional(args.notes),
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    ownerSubject: v.optional(v.string()),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationMember(
      ctx,
      args.organizationId,
    );
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.organizationId !== args.organizationId) {
      throw new Error("Contact not found.");
    }

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName && !lastName) throw new Error("A contact name is required.");
    await ensureCompany(ctx, args.organizationId, args.companyId);

    const ownerSubject =
      args.ownerSubject || contact.ownerSubject || identity.subject;
    if (
      !(await getOrganizationMember(
        ctx,
        args.organizationId,
        ownerSubject,
      ))
    ) {
      throw new Error("Selected owner is not a member of this organization.");
    }

    const email = cleanOptional(args.email)?.toLocaleLowerCase();
    if (email) {
      const duplicate = await ctx.db
        .query("contacts")
        .withIndex("by_organization_and_email", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("normalizedEmail", email),
        )
        .unique();
      if (duplicate && duplicate._id !== args.contactId) {
        throw new Error("A contact with this email already exists.");
      }
    }

    await ctx.db.patch(args.contactId, {
      firstName,
      lastName,
      normalizedName: normalizedName(firstName, lastName),
      email,
      normalizedEmail: email,
      phone: cleanOptional(args.phone),
      title: cleanOptional(args.title),
      companyId: args.companyId,
      ownerSubject,
      status: args.status,
      notes: cleanOptional(args.notes),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    contactId: v.id("contacts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const contact = await ctx.db.get(args.contactId);
    if (!contact || contact.organizationId !== args.organizationId) return null;

    const linkedDeal = await ctx.db
      .query("deals")
      .withIndex("by_organization_and_contact", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("contactId", args.contactId),
      )
      .first();
    if (linkedDeal) {
      throw new Error("Remove this contact from its deals before deleting it.");
    }

    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization_and_contact", (q) =>
        q
          .eq("organizationId", args.organizationId)
          .eq("contactId", args.contactId),
      )
      .take(500);
    for (const activity of activities) {
      await ctx.db.patch(activity._id, { contactId: undefined });
    }

    await ctx.db.delete(args.contactId);
    return null;
  },
});
