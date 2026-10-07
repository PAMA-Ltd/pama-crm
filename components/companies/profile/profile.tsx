"use client";

import { useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import DetailSection from "../detail/detail-section";
import ProfileAccount from "./profile-account";
import { ALL_OWNERS, formatMoney } from "@/lib/companies";
import { listOrganizationMembers } from "@/lib/convex/organizations";
import { useCompaniesStore } from "@/stores/companies-store";
import { useCompanies } from "@/hooks/use-companies";
import { useWorkspace } from "@/components/crm/workspace-provider";
import UsersIcon from "@/public/assets/images/companies/sidebar/users.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";
import MailIcon from "@/public/assets/images/companies/detail/mail-04.svg";

export default function Profile() {
  const { organization } = useWorkspace();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const profileSubject = useCompaniesStore((state) => state.profileName);
  const profileOpen = useCompaniesStore((state) => state.profileOpen);
  const { companies } = useCompanies();
  const closeProfile = useCompaniesStore((state) => state.closeProfile);
  const openDetail = useCompaniesStore((state) => state.openDetail);
  const setOwner = useCompaniesStore((state) => state.setOwner);

  const person = members.find((member) => member.userSubject === profileSubject);
  const accounts = person
    ? companies
        .filter((company) => company.ownerSubject === person.userSubject)
        .sort((a, b) => b.pipelineValue - a.pipelineValue)
    : [];

  const openDeals = accounts.reduce((sum, company) => sum + company.openDeals, 0);
  const pipeline = accounts.reduce((sum, company) => sum + company.pipelineValue, 0);
  const avgWin = accounts.length
    ? Math.round(
        accounts.reduce((sum, company) => sum + company.winProbability, 0) /
          accounts.length,
      )
    : 0;

  return (
    <Sheet
      open={profileOpen && person !== undefined}
      onOpenChange={(open) => !open && closeProfile()}
    >
      <SheetContent side="right" className="sm:w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <UsersIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Owner Profile</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Member details, pipeline summary and assigned accounts
          </SheetDescription>
          <SheetClose asChild>
            <Button variant="ghost" size="icon-sm" className="-mr-1" aria-label="Close profile">
              <XIcon aria-hidden className="text-foreground size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {person && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex items-center gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <span className="bg-muted flex size-[50px] items-center justify-center rounded-full text-lg font-medium">
                {(person.name || person.email || "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <h2 className="truncate">{person.name || person.email || "CRM member"}</h2>
                <span className="caption-style text-soft block capitalize">
                  {person.role}
                </span>
              </div>
            </div>

            {person.email && (
              <DetailSection title="Contact">
                <a
                  href={`mailto:${person.email}`}
                  className="hover:text-soft ease-power3-in-out flex items-center gap-1 transition-colors duration-150"
                >
                  <MailIcon aria-hidden className="text-soft size-3" />
                  {person.email}
                </a>
              </DetailSection>
            )}

            <DetailSection title="Pipeline">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Accounts", String(accounts.length)],
                  ["Open deals", String(openDeals)],
                  ["Pipeline", `$${formatMoney(pipeline)}`],
                  ["Avg. win", `${avgWin}%`],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-line-strong flex flex-col gap-3 rounded-lg border p-[11px]"
                  >
                    <span className="caption-style text-soft block">{label}</span>
                    <span className="lead-style block tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            </DetailSection>

            <DetailSection title="Accounts" className="shadow-none">
              {accounts.length > 0 ? (
                <ul className="-mx-2 flex flex-col gap-0.5">
                  {accounts.map((company) => (
                    <ProfileAccount
                      key={company.id}
                      company={company}
                      onOpen={() => openDetail(company.id)}
                    />
                  ))}
                </ul>
              ) : (
                <span className="caption-style text-subtle block">
                  No accounts assigned yet.
                </span>
              )}
            </DetailSection>
          </ScrollArea>
        )}

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="subtle" size="sm">Close</Button>
          </SheetClose>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (person) setOwner(person.userSubject);
              closeProfile();
            }}
            disabled={accounts.length === 0}
          >
            Filter table by owner
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOwner(ALL_OWNERS);
              closeProfile();
            }}
          >
            Clear filter
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
