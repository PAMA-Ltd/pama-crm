"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { useWorkspace } from "./workspace-provider";

export default function OrganizationSwitcher() {
  const { organization, organizations, setOrganizationId } = useWorkspace();

  return (
    <Select value={organization._id} onValueChange={setOrganizationId}>
      <SelectTrigger
        aria-label="Switch organization"
        className="h-8 w-full border-0 bg-transparent px-0 shadow-none"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((item) => (
          <SelectItem key={item._id} value={item._id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
