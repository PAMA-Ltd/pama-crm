"use client";

import { useQuery } from "convex/react";
import { listContacts } from "@/lib/convex/contacts";
import { useWorkspace } from "@/components/crm/workspace-provider";

export function useContacts() {
  const { organization } = useWorkspace();
  const contacts = useQuery(listContacts, {
    organizationId: organization._id,
    limit: 500,
  });
  return { contacts: contacts ?? [], isLoading: contacts === undefined };
}
