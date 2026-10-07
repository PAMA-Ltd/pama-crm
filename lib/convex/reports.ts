import { makeFunctionReference } from "convex/server";
import type { DealStage } from "./deals";

export type ForecastSummary = {
  openPipeline: number;
  weightedForecast: number;
  wonRevenue: number;
  winRate: number;
  openCount: number;
  wonCount: number;
  stages: Array<{
    stage: DealStage;
    count: number;
    total: number;
    weighted: number;
  }>;
};

export type CrmNotification = {
  id: string;
  title: string;
  description?: string;
  kind: string;
  companyId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  createdAt: number;
  overdue: boolean;
};

export type CompanyInsights = {
  activityTrend: number[];
  scoreCards: Array<{
    title: string;
    description: string;
    verdict: string;
    score: number;
  }>;
};

export const getForecast = makeFunctionReference<
  "query",
  { organizationId: string },
  ForecastSummary
>("reports:forecast");

export const listSlippingDeals = makeFunctionReference<
  "query",
  { organizationId: string; limit?: number },
  Array<{
    _id: string;
    name: string;
    companyId: string;
    amount: number;
    stage: DealStage;
    expectedCloseDate?: string;
    daysLate: number;
  }>
>("reports:slippingDeals");

export const listNotifications = makeFunctionReference<
  "query",
  { organizationId: string; limit?: number },
  CrmNotification[]
>("reports:notifications");

export const getCompanyInsights = makeFunctionReference<
  "query",
  { organizationId: string; companyId: string; days?: number },
  CompanyInsights
>("reports:companyInsights");
