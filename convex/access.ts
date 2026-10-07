import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCrmAccess } from "./authz";

export const status = query({
  args: {},
  returns: v.object({
    authenticated: v.boolean(),
    authorized: v.boolean(),
    email: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const access = await getCrmAccess(ctx);

    return {
      authenticated: access.authenticated,
      authorized: access.authorized,
      email: access.email,
    };
  },
});
