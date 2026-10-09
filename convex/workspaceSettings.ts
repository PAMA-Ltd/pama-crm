import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireOrganizationAdmin,
  requireOrganizationMember,
} from "./authz";
import { workspaceModuleValidator, workspacePresetValidator } from "./workspaceModels";
import { defaultWorkspaceSettings } from "../lib/workspaces/presets";

const settingsValidator = v.object({
  preset: workspacePresetValidator,
  enabledModules: v.array(workspaceModuleValidator),
  configVersion: v.number(),
  updatedAt: v.number(),
  updatedBy: v.string(),
});

export const get = query({
  args: { organizationId: v.id("organizations") },
  returns: settingsValidator,
  handler: async (ctx, { organizationId }) => {
    await requireOrganizationMember(ctx, organizationId);
    const saved = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .unique();
    if (!saved) return defaultWorkspaceSettings();
    return {
      preset: saved.preset,
      enabledModules: saved.enabledModules,
      configVersion: saved.configVersion,
      updatedAt: saved.updatedAt,
      updatedBy: saved.updatedBy,
    };
  },
});

export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    preset: workspacePresetValidator,
    enabledModules: v.array(workspaceModuleValidator),
    expectedVersion: v.number(),
  },
  returns: settingsValidator,
  handler: async (ctx, args) => {
    const { identity } = await requireOrganizationAdmin(ctx, args.organizationId);
    const organization = await ctx.db.get(args.organizationId);
    if (!organization || organization.status !== "active") {
      throw new Error("Only active workspaces can be customized.");
    }
    const saved = await ctx.db
      .query("organizationSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    const currentVersion = saved?.configVersion ?? 0;
    if (args.expectedVersion !== currentVersion) {
      throw new Error("Workspace layout changed since you opened it. Reload before saving.");
    }
    if (new Set(args.enabledModules).size !== args.enabledModules.length) {
      throw new Error("A module may be selected only once.");
    }
    if (args.enabledModules.length > 4) throw new Error("Too many modules.");

    const config = {
      preset: args.preset,
      enabledModules: args.enabledModules,
      configVersion: currentVersion + 1,
      updatedAt: Date.now(),
      updatedBy: identity.subject,
    };
    if (saved) {
      await ctx.db.patch(saved._id, config);
    } else {
      await ctx.db.insert("organizationSettings", { organizationId: args.organizationId, ...config });
    }
    return config;
  },
});
