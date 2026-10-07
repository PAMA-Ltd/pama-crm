import { makeFunctionReference } from "convex/server";

export type ContactStatus = "Lead" | "Active" | "Customer" | "Inactive";

export type CrmContact = {
  _id: string;
  _creationTime: number;
  organizationId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  ownerSubject?: string;
  status: ContactStatus;
  notes?: string;
  updatedAt: number;
};

export type ContactInput = {
  organizationId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  companyId?: string;
  ownerSubject?: string;
  status: ContactStatus;
  notes?: string;
};

export const listContacts = makeFunctionReference<
  "query",
  { organizationId: string; limit?: number },
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
  { organizationId: string; contactId: string },
  null
>("contacts:remove");
