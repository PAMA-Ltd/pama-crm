import { v } from "convex/values";

export const organizationRoleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

export const organizationStatusValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
);

export const sequenceStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
);

export const enrollmentStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const inviteStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("revoked"),
);

export const sequenceStepValidator = v.object({
  delayDays: v.number(),
  subject: v.string(),
  body: v.string(),
});
