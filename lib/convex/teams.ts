import { makeFunctionReference } from "convex/server";

export type CrmTeam = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  memberCount: number;
};

export const listTeams = makeFunctionReference<
  "query",
  { organizationId: string },
  CrmTeam[]
>("teams:list");

export const createTeam = makeFunctionReference<
  "mutation",
  { organizationId: string; name: string; description?: string },
  string
>("teams:create");

export const assignTeamMember = makeFunctionReference<
  "mutation",
  { organizationId: string; memberId: string; teamId?: string },
  null
>("teams:assignMember");
