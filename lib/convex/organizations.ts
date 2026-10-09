import { makeFunctionReference } from "convex/server";
import type { WorkspacePreset } from "@/lib/workspaces/presets";

export type OrganizationRole = "owner" | "admin" | "member";

export type CrmOrganization = {
  _id: string;
  _creationTime: number;
  name: string;
  slug: string;
  status: "active" | "archived";
  planName: string;
  billingEmail?: string;
  role: OrganizationRole;
};

export type OrganizationMember = {
  _id: string;
  userSubject: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  role: OrganizationRole;
  teamId?: string;
  joinedAt: number;
};

export const listOrganizations = makeFunctionReference<
  "query",
  Record<string, never>,
  CrmOrganization[]
>("organizations:listMine");

export const createOrganization = makeFunctionReference<
  "mutation",
  { name: string; slug?: string; billingEmail?: string; preset?: WorkspacePreset },
  string
>("organizations:create");

export const listOrganizationMembers = makeFunctionReference<
  "query",
  { organizationId: string },
  OrganizationMember[]
>("organizations:listMembers");

export const inviteOrganizationMember = makeFunctionReference<
  "mutation",
  { organizationId: string; email: string; role: OrganizationRole },
  string
>("organizations:inviteMember");

export const claimLegacyData = makeFunctionReference<
  "mutation",
  { organizationId: string },
  { companies: number; contacts: number; deals: number; activities: number }
>("organizations:claimLegacyData");


export type PendingOrganizationInvite = {
  _id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: OrganizationRole;
  expiresAt: number;
};

export const listPendingOrganizationInvites = makeFunctionReference<
  "query",
  Record<string, never>,
  PendingOrganizationInvite[]
>("organizations:listPendingInvites");

export const acceptOrganizationInvite = makeFunctionReference<
  "mutation",
  { inviteId: string },
  string
>("organizations:acceptInvite");
