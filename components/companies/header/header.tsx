"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import Button from "@/components/_ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/_ui/tabs";
import Notifications from "./notifications/notifications";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";
import ActiveDot from "@/public/assets/images/companies/header/active-dot.svg";
import SearchIcon from "@/public/assets/images/_common/search.svg";

const TABS = [
  { value: "companies", label: "Companies" },
  { value: "deals", label: "Deals" },
  { value: "forecast", label: "Forecast" },
];

export default function CompaniesHeader() {
  const { user } = useUser();
  const activeTab = useCompaniesStore((state) => state.activeTab);
  const setActiveTab = useCompaniesStore((state) => state.setActiveTab);
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);
  const setSearchOpen = useCompaniesStore((state) => state.setSearchOpen);

  return (
    <header className="shrink-0">
      <div className="flex items-center justify-between gap-2 px-4 py-[14px]">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon aria-hidden className="size-3.5" />
          </Button>
          <h1 className="truncate">Companies</h1>
          <span className="caption-style bg-muted inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#363636] py-[3px] pr-[5px] pl-[3px]">
            <ActiveDot aria-hidden className="size-3" />
            Active
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon aria-hidden className="size-3.5" />
          </Button>
          <Notifications />
          <div className="caption-style border-border bg-card flex h-[30px] items-center gap-1.5 rounded-md border py-[4px] pr-[7px] pl-[4px]">
            <UserButton />
            <span className="hidden max-w-[140px] truncate sm:inline">
              {user?.fullName ??
                user?.primaryEmailAddress?.emailAddress ??
                "Account"}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="border-border border-b px-4">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
  );
}
