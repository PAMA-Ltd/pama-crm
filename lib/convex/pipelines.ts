import { makeFunctionReference } from "convex/server";

export type CrmPipeline = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isDefault: boolean;
  dealCount: number;
  openValue: number;
};

export const listPipelines = makeFunctionReference<
  "query",
  { organizationId: string },
  CrmPipeline[]
>("pipelines:list");

export const createPipeline = makeFunctionReference<
  "mutation",
  { organizationId: string; name: string; description?: string },
  string
>("pipelines:create");
