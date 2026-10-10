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

export const workspacePresetValidator = v.union(
  v.literal("sales"),
  v.literal("commerce"),
  v.literal("saas"),
  v.literal("services"),
  v.literal("education"),
  v.literal("custom"),
);

export const workspaceModuleValidator = v.union(
  v.literal("sales"),
  v.literal("lifecycle"),
  v.literal("campaigns"),
  v.literal("automations"),
);
