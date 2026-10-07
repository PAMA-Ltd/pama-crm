import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrganizationAdmin,
  requireOrganizationMember,
} from "./authz";
import {
  enrollmentStatusValidator,
  sequenceStatusValidator,
  sequenceStepValidator,
} from "./workspaceModels";

export const list = query({
  args: { organizationId: v.id("organizations") },
  returns: v.array(
    v.object({
      _id: v.id("emailSequences"),
      name: v.string(),
      status: sequenceStatusValidator,
      steps: v.array(sequenceStepValidator),
      enrollmentCount: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const sequences = await ctx.db
      .query("emailSequences")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    const result = [];
    for (const sequence of sequences) {
      const enrollments = await ctx.db
        .query("sequenceEnrollments")
        .withIndex("by_sequence", (q) => q.eq("sequenceId", sequence._id))
        .take(500);
      result.push({
        _id: sequence._id,
        name: sequence.name,
        status: sequence.status,
        steps: sequence.steps,
        enrollmentCount: enrollments.length,
        updatedAt: sequence.updatedAt,
      });
    }
    return result;
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    status: sequenceStatusValidator,
    steps: v.array(sequenceStepValidator),
  },
  returns: v.id("emailSequences"),
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationAdmin(
      ctx,
      args.organizationId,
    );
    const name = args.name.trim();
    if (!name) throw new Error("Sequence name is required.");
    if (args.steps.length === 0) throw new Error("Add at least one sequence step.");

    const now = Date.now();
    return await ctx.db.insert("emailSequences", {
      organizationId: args.organizationId,
      name,
      status: args.status,
      steps: args.steps.map((step) => ({
        delayDays: Math.max(0, Math.round(step.delayDays)),
        subject: step.subject.trim(),
        body: step.body.trim(),
      })),
      createdBy: identity.subject,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    sequenceId: v.id("emailSequences"),
    name: v.string(),
    status: sequenceStatusValidator,
    steps: v.array(sequenceStepValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.organizationId !== args.organizationId) {
      throw new Error("Sequence not found.");
    }
    if (!args.name.trim()) throw new Error("Sequence name is required.");
    if (args.steps.length === 0) throw new Error("Add at least one sequence step.");

    await ctx.db.patch(args.sequenceId, {
      name: args.name.trim(),
      status: args.status,
      steps: args.steps.map((step) => ({
        delayDays: Math.max(0, Math.round(step.delayDays)),
        subject: step.subject.trim(),
        body: step.body.trim(),
      })),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const enroll = mutation({
  args: {
    organizationId: v.id("organizations"),
    sequenceId: v.id("emailSequences"),
    contactId: v.id("contacts"),
  },
  returns: v.id("sequenceEnrollments"),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const sequence = await ctx.db.get(args.sequenceId);
    const contact = await ctx.db.get(args.contactId);
    if (!sequence || sequence.organizationId !== args.organizationId) {
      throw new Error("Sequence not found.");
    }
    if (!contact || contact.organizationId !== args.organizationId) {
      throw new Error("Contact not found.");
    }

    const existing = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_and_contact", (q) =>
        q.eq("sequenceId", args.sequenceId).eq("contactId", args.contactId),
      )
      .unique();
    if (existing) throw new Error("Contact is already enrolled.");

    const now = Date.now();
    return await ctx.db.insert("sequenceEnrollments", {
      organizationId: args.organizationId,
      sequenceId: args.sequenceId,
      contactId: args.contactId,
      status: "active",
      currentStep: 0,
      nextStepAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setEnrollmentStatus = mutation({
  args: {
    organizationId: v.id("organizations"),
    enrollmentId: v.id("sequenceEnrollments"),
    status: enrollmentStatusValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const enrollment = await ctx.db.get(args.enrollmentId);
    if (!enrollment || enrollment.organizationId !== args.organizationId) {
      throw new Error("Enrollment not found.");
    }
    await ctx.db.patch(args.enrollmentId, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const remove = mutation({
  args: {
    organizationId: v.id("organizations"),
    sequenceId: v.id("emailSequences"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizationAdmin(ctx, args.organizationId);
    const sequence = await ctx.db.get(args.sequenceId);
    if (!sequence || sequence.organizationId !== args.organizationId) {
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
    return null;
  },
});
