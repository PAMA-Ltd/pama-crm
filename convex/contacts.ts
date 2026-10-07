import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCrmUser } from "./authz";
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

export const list = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(contactResultValidator),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const limit = Math.min(
      Math.max(Math.floor(args.limit ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );
    const contacts = await ctx.db.query("contacts").order("desc").take(limit);

    return contacts.map((contact) => ({
      _id: contact._id,
      _creationTime: contact._creationTime,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      title: contact.title,
      companyId: contact.companyId,
      status: contact.status,
      notes: contact.notes,
      updatedAt: contact.updatedAt,
    }));
  },
});

export const create = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.id("contacts"),
  handler: async (ctx, args) => {
    const identity = await requireCrmUser(ctx);
    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();

    if (!firstName && !lastName) {
      throw new Error("A contact name is required.");
    }

    if (args.companyId && !(await ctx.db.get(args.companyId))) {
      throw new Error("Company not found.");
    }

    const email = cleanOptional(args.email)?.toLocaleLowerCase();
    if (email) {
      const existing = await ctx.db
        .query("contacts")
        .withIndex("by_normalized_email", (q) =>
          q.eq("normalizedEmail", email),
        )
        .first();
      if (existing) throw new Error("A contact with this email already exists.");
    }

    return await ctx.db.insert("contacts", {
      firstName,
      lastName,
      normalizedName: normalizedName(firstName, lastName),
      email,
      normalizedEmail: email,
      phone: cleanOptional(args.phone),
      title: cleanOptional(args.title),
      companyId: args.companyId,
      status: args.status,
      notes: cleanOptional(args.notes),
      createdBy: identity.subject,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    contactId: v.id("contacts"),
    firstName: v.string(),
    lastName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    title: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    status: contactStatusValidator,
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found.");

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName && !lastName) throw new Error("A contact name is required.");

    if (args.companyId && !(await ctx.db.get(args.companyId))) {
      throw new Error("Company not found.");
    }

    const email = cleanOptional(args.email)?.toLocaleLowerCase();
    if (email) {
      const duplicate = await ctx.db
        .query("contacts")
        .withIndex("by_normalized_email", (q) =>
          q.eq("normalizedEmail", email),
        )
        .first();
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
      status: args.status,
      notes: cleanOptional(args.notes),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: { contactId: v.id("contacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireCrmUser(ctx);
    const contact = await ctx.db.get(args.contactId);
    if (!contact) return null;

    const linkedDeal = await ctx.db
      .query("deals")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .first();
    if (linkedDeal) {
      throw new Error("Remove this contact from its deals before deleting it.");
    }

    await ctx.db.delete(args.contactId);
    return null;
  },
});
