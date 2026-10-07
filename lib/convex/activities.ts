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
  type: ActivityType;
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
  type: ActivityType;
  subject: string;
  description?: string;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  dueAt?: number;
};

export const listActivities = makeFunctionReference<
  "query",
  { limit?: number },
  CrmActivity[]
>("activities:list");

export const createActivity = makeFunctionReference<
  "mutation",
  ActivityInput,
  string
>("activities:create");

export const setActivityCompleted = makeFunctionReference<
  "mutation",
  { activityId: string; completed: boolean },
  null
>("activities:setCompleted");

export const removeActivity = makeFunctionReference<
  "mutation",
  { activityId: string },
  null
>("activities:remove");
