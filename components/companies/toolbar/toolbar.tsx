"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import FilterMenu from "@/components/_common/filter-menu";
import MobileFilters from "./mobile-filters";
import ImportCompaniesDialog from "../import/import-companies-dialog";
import {
  ACTIVITY_OPTIONS,
  SORT_MENU_OPTIONS,
  STAGE_OPTIONS,
} from "./filter-options";
import type { SortKey } from "@/data/companies";
import {
  ALL_OWNERS,
  TODAY,
  companiesCsvRows,
  filterCompanies,
} from "@/lib/companies";
import { downloadCsv } from "@/lib/csv";
import { listOrganizationMembers } from "@/lib/convex/organizations";
import { useCompaniesStore } from "@/stores/companies-store";
import { useCompanies } from "@/hooks/use-companies";
import { useWorkspace } from "@/components/crm/workspace-provider";
import ShareIcon from "@/public/assets/images/companies/toolbar/share.svg";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

export default function CompaniesToolbar() {
  const { organization } = useWorkspace();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const { companies } = useCompanies();
  const [importOpen, setImportOpen] = useState(false);
  const sortBy = useCompaniesStore((state) => state.sortBy);
  const owner = useCompaniesStore((state) => state.owner);
  const stage = useCompaniesStore((state) => state.stage);
  const activityWindow = useCompaniesStore((state) => state.activityWindow);
  const setSortBy = useCompaniesStore((state) => state.setSortBy);
  const setOwner = useCompaniesStore((state) => state.setOwner);
  const setStage = useCompaniesStore((state) => state.setStage);
  const setActivityWindow = useCompaniesStore((state) => state.setActivityWindow);
  const setNewCompanyOpen = useCompaniesStore((state) => state.setNewCompanyOpen);

  const ownerOptions = [
    { value: ALL_OWNERS, label: "All Owners" },
    ...members.map((member) => ({
      value: member.userSubject,
      label: member.name || member.email || "CRM member",
    })),
  ];

  function exportCsv() {
    const visible = filterCompanies(companies, {
      sortBy,
      owner,
      stage,
      activityWindow,
    });
    downloadCsv(`companies-${TODAY}.csv`, companiesCsvRows(visible));
  }

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-4">
        <MobileFilters className="sm:hidden" />

        <div className="hidden min-w-0 flex-wrap gap-2 sm:flex">
          <FilterMenu
            label="Sort by"
            value={sortBy}
            options={SORT_MENU_OPTIONS}
            onChange={(value) => setSortBy(value as SortKey)}
          />
          <FilterMenu
            label="Filter"
            value={owner}
            options={ownerOptions}
            onChange={setOwner}
          />
          <FilterMenu
            label="Stage"
            value={stage}
            options={STAGE_OPTIONS}
            onChange={setStage}
          />
          <FilterMenu
            label="Last Activity"
            value={String(activityWindow)}
            options={ACTIVITY_OPTIONS}
            onChange={(value) => setActivityWindow(Number(value))}
          />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <ShareIcon aria-hidden className="size-3" />
            Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNewCompanyOpen(true)}
          >
            <PlusIcon aria-hidden className="size-3" />
            New Company
          </Button>
        </div>
      </div>
      <ImportCompaniesDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
