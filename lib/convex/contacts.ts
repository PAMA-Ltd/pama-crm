import { makeFunctionReference } from "convex/server";

export type ContactStatus = "Lead" | "Active" | "Customer" | "Inactive";

export type CrmContact = {
  _id: string;
  _creationTime: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  status: ContactStatus;
  notes?: string;
  updatedAt: number;
};

export type ContactInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  status: ContactStatus;
  notes?: string;
};

export const listContacts = makeFunctionReference<
  "query",
  { limit?: number },
  CrmContact[]
>("contacts:list");

export const createContact = makeFunctionReference<
  "mutation",
  ContactInput,
  string
>("contacts:create");

export const updateContact = makeFunctionReference<
  "mutation",
  ContactInput & { contactId: string },
  null
>("contacts:update");

export const removeContact = makeFunctionReference<
  "mutation",
  { contactId: string },
  null
>("contacts:remove");
