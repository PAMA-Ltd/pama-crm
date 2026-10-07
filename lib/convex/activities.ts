import { makeFunctionReference } from "convex/server";

export type ActivityType = "Call" | "Email" | "Meeting" | "Note" | "Task";

export const ACTIVITY_TYPES: ActivityType[] = [
  "Call",
  "Email",
  "Meeting",
  "Note",
  "Task",
];

export type CrmActivity = {
  _id: string;
  _creationTime: number;
  organizationId?: string;
  type: ActivityType;
  source?: "human" | "system" | "mcp";
  subject: string;
  description?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  dueAt?: number;
  completedAt?: number;
  updatedAt: number;
};

export type ActivityInput = {
  organizationId: string;
  type: ActivityType;
  source?: "human" | "system" | "mcp";
  subject: string;
  description?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  dueAt?: number;
};

export const listActivities = makeFunctionReference<
  "query",
  { organizationId: string; limit?: number },
  CrmActivity[]
>("activities:list");

export const createActivity = makeFunctionReference<
  "mutation",
  ActivityInput,
  string
>("activities:create");

export const updateActivity = makeFunctionReference<
  "mutation",
  ActivityInput & { activityId: string },
  null
>("activities:update");

export const setActivityCompleted = makeFunctionReference<
  "mutation",
  { organizationId: string; activityId: string; completed: boolean },
  null
>("activities:setCompleted");

export const removeActivity = makeFunctionReference<
  "mutation",
  { organizationId: string; activityId: string },
  null
>("activities:remove");
