"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  return (
    <Select value={organization._id} onValueChange={(id) => {
      if (id === organization._id) return;
      setOrganizationId(id);
      router.push("/workspace");
    }}>
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
