import { makeFunctionReference } from "convex/server";
import type { Company, Tag } from "@/data/companies";

export type ConvexCompany = Omit<Company, "id" | "activityDays"> & {
  _id: string;
  _creationTime: number;
  organizationId?: string;
  ownerSubject?: string;
};

export type CreateCompanyArgs = {
  organizationId: string;
  name: string;
  tags: Tag[];
  ownerSubject?: string;
  lastInteraction: { date: string; label: string };
  logo?: string;
};

export const listCompanies = makeFunctionReference<
  "query",
  { organizationId: string; limit?: number },
  ConvexCompany[]
>("companies:list");

export const createCompany = makeFunctionReference<
  "mutation",
  CreateCompanyArgs,
  string
>("companies:create");

export const updateCompany = makeFunctionReference<
  "mutation",
  CreateCompanyArgs & { companyId: string },
  null
>("companies:update");

export const removeCompany = makeFunctionReference<
  "mutation",
  { organizationId: string; companyId: string },
  null
>("companies:remove");

export const importCompanies = makeFunctionReference<
  "mutation",
  {
    organizationId: string;
    rows: Array<{
      name: string;
      tags: Tag[];
      ownerSubject?: string;
      lastInteraction?: { date: string; label: string };
      logo?: string;
    }>;
  },
  {
    created: number;
    skipped: number;
    errors: Array<{ row: number; message: string }>;
  }
>("companies:importBatch");
