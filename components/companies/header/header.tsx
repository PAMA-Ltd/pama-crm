"use client";

import Button from "@/components/_ui/button";
import PageHeader from "@/components/crm/page-header";
import SalesTabs from "@/components/crm/sales-tabs";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { useCompaniesStore } from "@/stores/companies-store";
import SearchIcon from "@/public/assets/images/_common/search.svg";
import ActiveDot from "@/public/assets/images/companies/header/active-dot.svg";

export default function CompaniesHeader() {
  const { organization } = useWorkspace();
  const setSearchOpen = useCompaniesStore((state) => state.setSearchOpen);

  return (
    <div className="shrink-0">
      <PageHeader
        title="Companies"
        description="Accounts and pipeline health"
        statusBadge={
          <span className="caption-style bg-muted inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#363636] py-[3px] pr-[5px] pl-[3px] capitalize">
            <ActiveDot aria-hidden className="size-3" />
            {organization.status}
          </span>
        }
        actions={
          <Button
            variant="secondary"
            size="icon"
            aria-label="Search companies"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => setSearchOpen(true)}
          >
            <SearchIcon aria-hidden className="size-3.5" />
          </Button>
        }
      />
      <SalesTabs />
    </div>
  );
}
