"use client";

import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/_ui/scroll-area";
import SidebarNavItem from "./sidebar-nav-item";
import SidebarSection from "./sidebar-section";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import Logo from "@/public/assets/images/_common/logo.svg";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import BarChartIcon from "@/public/assets/images/companies/sidebar/bar-chart.svg";
import ListIcon from "@/public/assets/images/companies/sidebar/list.svg";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";

const NAV_ITEMS = [
  { href: "/companies", label: "Companies", icon: BuildingIcon },
  { href: "/contacts", label: "Contacts", icon: BookClosedIcon },
  { href: "/deals", label: "Deals Board", icon: ClipboardIcon },
  { href: "/activities", label: "Activities", icon: ListIcon },
  { href: "/forecast", label: "Forecast", icon: BarChartIcon },
] as const;

export default function SidebarContent() {
  const pathname = usePathname();
  const { companies } = useCompanies();
  const { contacts } = useContacts();
  const { deals } = useDeals();

  const counts: Record<string, number | undefined> = {
    "/companies": companies.length,
    "/contacts": contacts.length,
    "/deals": deals.filter(
      (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
    ).length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <Logo aria-hidden className="size-8 shrink-0 overflow-visible" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">
            Pama CRM
          </span>
          <span className="caption-style text-subtle block truncate">
            Internal sales workspace
          </span>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Primary" className="py-1">
          <SidebarSection>
            {NAV_ITEMS.map((item) => (
              <SidebarNavItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                href={item.href}
                count={counts[item.href]}
                active={pathname === item.href}
              />
            ))}
          </SidebarSection>
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border bg-sidebar-accent shrink-0 border-t p-3">
        <p className="caption-style text-subtle leading-4">
          Companies, contacts, deals and follow-ups stay synced through Convex.
        </p>
      </div>
    </div>
  );
}
