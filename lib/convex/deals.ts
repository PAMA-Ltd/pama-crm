import { makeFunctionReference } from "convex/server";

export type DealStage =
  | "Lead"
  | "Qualified"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

export const DEAL_STAGES: DealStage[] = [
  "Lead",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

export type CrmDeal = {
  _id: string;
  _creationTime: number;
  organizationId?: string;
  name: string;
  companyId: string;
  contactId?: string;
  pipelineId?: string;
  amount: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: string;
  notes?: string;
  updatedAt: number;
};

export type DealInput = {
  organizationId: string;
  name: string;
  companyId: string;
  contactId?: string;
  pipelineId?: string;
  amount: number;
  stage: DealStage;
  expectedCloseDate?: string;
  notes?: string;
};

export const listDeals = makeFunctionReference<
  "query",
  { organizationId: string; pipelineId?: string; limit?: number },
  CrmDeal[]
>("deals:list");

export const createDeal = makeFunctionReference<
  "mutation",
  DealInput,
  string
>("deals:create");

export const updateDeal = makeFunctionReference<
  "mutation",
  DealInput & { dealId: string },
  null
>("deals:update");

export const updateDealStage = makeFunctionReference<
  "mutation",
  { organizationId: string; dealId: string; stage: DealStage },
  null
>("deals:updateStage");

export const removeDeal = makeFunctionReference<
  "mutation",
  { organizationId: string; dealId: string },
  null
>("deals:remove");
