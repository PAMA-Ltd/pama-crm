import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type AuthOnlyContext = {
  auth: QueryCtx["auth"];
};

type DataContext = QueryCtx | MutationCtx;

export async function getCrmAccess(ctx: AuthOnlyContext) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return {
      authenticated: false,
      authorized: false,
      email: null,
      identity: null,
    } as const;
  }

  return {
    authenticated: true,
    authorized: true,
    email: identity.email?.trim().toLocaleLowerCase() ?? null,
    identity,
  } as const;
}

export async function requireCrmUser(ctx: AuthOnlyContext) {
  const access = await getCrmAccess(ctx);

  if (!access.authenticated || !access.identity) {
    throw new Error("Not authenticated.");
  }

  return access.identity;
}

export async function getOrganizationMember(
  ctx: DataContext,
  organizationId: Id<"organizations">,
  userSubject: string,
) {
  return await ctx.db
    .query("organizationMembers")
    .withIndex("by_organization_and_user", (q) =>
      q.eq("organizationId", organizationId).eq("userSubject", userSubject),
    )
    .unique();
}

export async function requireOrganizationMember(
  ctx: DataContext,
  organizationId: Id<"organizations">,
) {
  const identity = await requireCrmUser(ctx);
  const member = await getOrganizationMember(
    ctx,
    organizationId,
    identity.subject,
  );

  if (!member) {
    throw new Error("You do not have access to this organization.");
  }

  return { identity, member };
}

export async function requireOrganizationAdmin(
  ctx: DataContext,
  organizationId: Id<"organizations">,
) {
  const access = await requireOrganizationMember(ctx, organizationId);
  if (access.member.role === "member") {
    throw new Error("Organization admin access is required.");
  }
  return access;
}

export async function requireOrganizationOwner(
  ctx: DataContext,
  organizationId: Id<"organizations">,
) {
  const access = await requireOrganizationMember(ctx, organizationId);
  if (access.member.role !== "owner") {
    throw new Error("Organization owner access is required.");
  }
  return access;
}

export async function resolveOrganizationBySlugForUser(
  ctx: DataContext,
  slug: string,
  userSubject: string,
) {
  const organization = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug.trim().toLocaleLowerCase()))
    .unique();

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const member = await getOrganizationMember(
    ctx,
    organization._id,
    userSubject,
  );
  if (!member) {
    throw new Error("You do not have access to this organization.");
  }

  return { organization, member };
}
