"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";

const ITEMS = [
  { value: "companies", label: "Companies", href: "/companies" },
  { value: "deals", label: "Deals", href: "/deals" },
  { value: "forecast", label: "Forecast", href: "/forecast" },
] as const;

export default function SalesTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active =
    ITEMS.find((item) => pathname.startsWith(item.href))?.value ?? "companies";

  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        const item = ITEMS.find((entry) => entry.value === value);
        if (item) router.push(item.href);
      }}
    >
      <TabsList className="border-border border-b px-4">
        {ITEMS.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
