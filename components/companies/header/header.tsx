"use client";

import Button from "@/components/_ui/button";
import PageHeader from "@/components/crm/page-header";
import { useCompaniesStore } from "@/stores/companies-store";
import SearchIcon from "@/public/assets/images/_common/search.svg";

export default function CompaniesHeader() {
  const setSearchOpen = useCompaniesStore((state) => state.setSearchOpen);

  return (
    <PageHeader
      title="Companies"
      description="Accounts and pipeline health"
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
  );
}
