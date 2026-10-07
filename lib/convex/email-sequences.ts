import { makeFunctionReference } from "convex/server";

export type SequenceStatus = "draft" | "active" | "paused";
export type SequenceStep = { delayDays: number; subject: string; body: string };

export type EmailSequence = {
  _id: string;
  name: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  enrollmentCount: number;
  updatedAt: number;
};

export const listEmailSequences = makeFunctionReference<
  "query",
  { organizationId: string },
  EmailSequence[]
>("emailSequences:list");

export const createEmailSequence = makeFunctionReference<
  "mutation",
  {
    organizationId: string;
    name: string;
    status: SequenceStatus;
    steps: SequenceStep[];
  },
  string
>("emailSequences:create");

export const updateEmailSequence = makeFunctionReference<
  "mutation",
  {
    organizationId: string;
    sequenceId: string;
    name: string;
    status: SequenceStatus;
    steps: SequenceStep[];
  },
  null
>("emailSequences:update");

export const enrollContact = makeFunctionReference<
  "mutation",
  { organizationId: string; sequenceId: string; contactId: string },
  string
>("emailSequences:enroll");
