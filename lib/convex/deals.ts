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
  name: string;
  companyId: string;
  contactId?: string;
  amount: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: string;
  notes?: string;
  updatedAt: number;
};

export type DealInput = {
  name: string;
  companyId: string;
  contactId?: string;
  amount: number;
  stage: DealStage;
  expectedCloseDate?: string;
  notes?: string;
};

export const listDeals = makeFunctionReference<
  "query",
  { limit?: number },
  CrmDeal[]
>("deals:list");

export const createDeal = makeFunctionReference<
  "mutation",
  DealInput,
  string
>("deals:create");

export const updateDealStage = makeFunctionReference<
  "mutation",
  { dealId: string; stage: DealStage },
  null
>("deals:updateStage");

export const removeDeal = makeFunctionReference<
  "mutation",
  { dealId: string },
  null
>("deals:remove");
