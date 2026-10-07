import { makeFunctionReference } from "convex/server";
import type { Company, Tag } from "@/data/companies";

export type ConvexCompany = Omit<Company, "id" | "activityDays"> & {
  _id: string;
  _creationTime: number;
};

export type CreateCompanyArgs = {
  name: string;
  tags: Tag[];
  lastInteraction: {
    date: string;
    label: string;
  };
  logo?: string;
};

export const listCompanies = makeFunctionReference<
  "query",
  { limit?: number },
  ConvexCompany[]
>("companies:list");

export const createCompany = makeFunctionReference<
  "mutation",
  CreateCompanyArgs,
  string
>("companies:create");
