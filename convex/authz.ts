import type { UserIdentity } from "convex/server";

type AuthContext = {
  auth: {
    getUserIdentity: () => Promise<UserIdentity | null>;
  };
};

function allowedEmails() {
  return new Set(
    (process.env.PAMA_CRM_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase())
      .filter(Boolean),
  );
}

export async function getCrmAccess(ctx: AuthContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return {
      authenticated: false,
      authorized: false,
      email: null,
      identity: null,
    } as const;
  }

  const email = identity.email?.trim().toLocaleLowerCase() ?? null;
  const authorized = email !== null && allowedEmails().has(email);

  return {
    authenticated: true,
    authorized,
    email,
    identity,
  } as const;
}

export async function requireCrmUser(ctx: AuthContext) {
  const access = await getCrmAccess(ctx);

  if (!access.authenticated) {
    throw new Error("Not authenticated.");
  }

  if (!access.authorized || !access.identity) {
    throw new Error("You do not have access to Pama CRM.");
  }

  return access.identity;
}
