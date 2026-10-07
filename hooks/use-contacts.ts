"use client";

import { useQuery } from "convex/react";
import { listContacts } from "@/lib/convex/contacts";

export function useContacts() {
  const contacts = useQuery(listContacts, { limit: 500 });
  return {
    contacts: contacts ?? [],
    isLoading: contacts === undefined,
  };
}
