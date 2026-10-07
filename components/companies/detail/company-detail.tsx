"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Asset from "@/components/_ui/asset";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FilterMenu from "@/components/_common/filter-menu";
import DetailSection from "./detail-section";
import PipelineHealth from "./pipeline-health";
import ActivityTrend from "./activity-trend";
import ScoreCard from "./score-card";
import {
  INTERACTION_TYPES,
  SEGMENTS,
  STAGES,
  TAG_TONES,
  TREND_WINDOWS,
  type ScoreCard as ScoreCardData,
  type Segment,
  type Stage,
} from "@/data/companies";
import { TODAY, formatMoney } from "@/lib/companies";
import {
  getCompanyInsights,
  type CompanyInsights,
} from "@/lib/convex/reports";
import {
  removeCompany,
  updateCompany,
} from "@/lib/convex/companies";
import { listOrganizationMembers } from "@/lib/convex/organizations";
import { useCompaniesStore } from "@/stores/companies-store";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import { useActivities } from "@/hooks/use-activities";
import { useWorkspace } from "@/components/crm/workspace-provider";
import BuildingIcon from "@/public/assets/images/companies/detail/building.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

const WINDOW_OPTIONS = [
  { value: "Last 7 Days", label: "Last 7 Days" },
  { value: "Last 30 Days", label: "Last 30 Days" },
  { value: "Last 90 Days", label: "Last 90 Days" },
];

function daysForWindow(value: string) {
  if (value === "Last 7 Days") return 7;
  if (value === "Last 90 Days") return 90;
  return 30;
}

export default function CompanyDetail() {
  const { organization } = useWorkspace();
  const detailId = useCompaniesStore((state) => state.detailId);
  const detailOpen = useCompaniesStore((state) => state.detailOpen);
  const closeDetail = useCompaniesStore((state) => state.closeDetail);
  const openProfile = useCompaniesStore((state) => state.openProfile);
  const { companies } = useCompanies();
  const { contacts } = useContacts();
  const { deals } = useDeals();
  const { activities } = useActivities();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const update = useMutation(updateCompany);
  const remove = useMutation(removeCompany);
  const [trendWindow, setTrendWindow] = useState(TREND_WINDOWS[1]);
  const [scoreWindow, setScoreWindow] = useState(TREND_WINDOWS[1]);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const company = companies.find((item) => item.id === detailId);
  const companyId = company?.id;
  const insights = useQuery(
    getCompanyInsights,
    companyId
      ? {
          organizationId: organization._id,
          companyId,
          days: daysForWindow(trendWindow),
        }
      : "skip",
  ) as CompanyInsights | undefined;

  const scoreInsights = useQuery(
    getCompanyInsights,
    companyId
      ? {
          organizationId: organization._id,
          companyId,
          days: daysForWindow(scoreWindow),
        }
      : "skip",
  ) as CompanyInsights | undefined;

  const linkedContacts = contacts.filter(
    (contact) => contact.companyId === companyId,
  );
  const linkedDeals = deals.filter((deal) => deal.companyId === companyId);
  const linkedActivities = activities.filter(
    (activity) => activity.companyId === companyId,
  );

  const owner = members.find(
    (member) => member.userSubject === company?.ownerSubject,
  );

  const [edit, setEdit] = useState({
    name: "",
    segment: SEGMENTS[0] as Segment,
    stage: STAGES[0] as Stage,
    ownerSubject: "",
    interactionDate: TODAY,
    interactionType: INTERACTION_TYPES[0] as string,
  });

  function beginEdit() {
    if (!company) return;
    setEdit({
      name: company.name,
      segment:
        (company.tags.find((tag) =>
          (SEGMENTS as readonly string[]).includes(tag),
        ) as Segment | undefined) ?? SEGMENTS[0],
      stage:
        (company.tags.find((tag) =>
          (STAGES as readonly string[]).includes(tag),
        ) as Stage | undefined) ?? STAGES[0],
      ownerSubject: company.ownerSubject ?? "",
      interactionDate: company.lastInteraction.date,
      interactionType: company.lastInteraction.label,
    });
    setError(null);
    setEditOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      await update({
        organizationId: organization._id,
        companyId: company.id,
        name: edit.name,
        tags: [edit.segment, edit.stage],
        ownerSubject: edit.ownerSubject || undefined,
        lastInteraction: {
          date: edit.interactionDate,
          label: edit.interactionType,
        },
        logo: company.logo,
      });
      setEditOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update company.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany() {
    if (!company) return;
    if (
      !window.confirm(
        `Delete ${company.name}? This only works when it has no linked CRM records.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await remove({
        organizationId: organization._id,
        companyId: company.id,
      });
      closeDetail();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete company.",
      );
    }
  }

  return (
    <>
      <Sheet
        open={detailOpen && company !== undefined}
        onOpenChange={(open) => !open && closeDetail()}
      >
        <SheetContent side="right" className="sm:w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <BuildingIcon aria-hidden className="text-icon size-3.5" />
              <SheetTitle>Company Detail</SheetTitle>
            </div>
            <SheetDescription className="sr-only">
              Account summary, pipeline health, activity, linked records and score cards
            </SheetDescription>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1"
                aria-label="Close details"
              >
                <XIcon aria-hidden className="text-foreground size-4" />
              </Button>
            </SheetClose>
          </SheetHeader>

          {company && (
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex items-start gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
                <span className="bg-muted flex size-[50px] shrink-0 items-center justify-center rounded-[12.5px] shadow-[0px_6.25px_6.25px_0px_rgba(15,15,15,0.24),0px_0px_0px_1.563px_#232323]">
                  {company.logo ? (
                    <Asset
                      type="image"
                      src={company.logo}
                      alt={`${company.name} logo`}
                      width={1}
                      height={1}
                      fit="contain"
                      className="size-8"
                    />
                  ) : (
                    <span className="h2-style text-soft">
                      {company.name.slice(0, 1)}
                    </span>
                  )}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="truncate">{company.name}</h2>
                    <Button variant="secondary" size="sm" onClick={beginEdit}>
                      Edit
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-[3px]">
                    {company.tags.map((tag) => (
                      <Tag key={tag} tone={TAG_TONES[tag]} size="sm">
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              </div>

              <DetailSection title="Account summary">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Owner", owner?.name || owner?.email || company.owner],
                    ["Contacts", String(linkedContacts.length)],
                    ["Open deals", String(company.openDeals)],
                    ["Pipeline", `$${formatMoney(company.pipelineValue)}`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="border-line-strong flex min-w-0 flex-col gap-2 rounded-lg border p-[11px]"
                    >
                      <span className="caption-style text-soft">{label}</span>
                      {label === "Owner" && company.ownerSubject ? (
                        <Button
                          variant="link"
                          size="none"
                          className="justify-start truncate"
                          onClick={() => openProfile(company.ownerSubject!)}
                        >
                          {value}
                        </Button>
                      ) : (
                        <span className="lead-style truncate tabular-nums">
                          {value}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </DetailSection>

              <DetailSection title="Pipeline health">
                <PipelineHealth company={company} deals={linkedDeals} />
              </DetailSection>

              <DetailSection
                title="Activity trend"
                action={
                  <FilterMenu
                    value={trendWindow}
                    options={WINDOW_OPTIONS}
                    onChange={setTrendWindow}
                    align="end"
                  />
                }
              >
                <ActivityTrend
                  trend={insights?.activityTrend ?? []}
                  activities={linkedActivities}
                />
              </DetailSection>

              <DetailSection title="Linked contacts">
                {linkedContacts.length ? (
                  <div className="space-y-2">
                    {linkedContacts.slice(0, 8).map((contact) => (
                      <div
                        key={contact._id}
                        className="border-line-strong flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {[contact.firstName, contact.lastName]
                              .filter(Boolean)
                              .join(" ")}
                          </p>
                          <p className="caption-style text-subtle mt-1 truncate">
                            {contact.title || contact.email || contact.status}
                          </p>
                        </div>
                        <span className="caption-style text-soft">
                          {contact.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="caption-style text-subtle">No contacts linked yet.</p>
                )}
              </DetailSection>

              <DetailSection title="Linked deals">
                {linkedDeals.length ? (
                  <div className="space-y-2">
                    {linkedDeals.slice(0, 8).map((deal) => (
                      <div
                        key={deal._id}
                        className="border-line-strong flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{deal.name}</p>
                          <p className="caption-style text-subtle mt-1">
                            {deal.stage} · {deal.probability}%
                          </p>
                        </div>
                        <span className="tabular-nums">
                          ${formatMoney(deal.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="caption-style text-subtle">No deals linked yet.</p>
                )}
              </DetailSection>

              <DetailSection
                title="Score card"
                className="gap-3"
                action={
                  <FilterMenu
                    value={scoreWindow}
                    options={WINDOW_OPTIONS}
                    onChange={setScoreWindow}
                    align="end"
                    className="shadow-[0px_4px_4px_0px_rgba(15,15,15,0.24),0px_0px_0px_1px_#393939]"
                  />
                }
              >
                <div className="flex flex-col gap-2">
                  {(scoreInsights?.scoreCards ?? []).map((card) => (
                    <ScoreCard key={card.title} card={card as ScoreCardData} />
                  ))}
                  {!scoreInsights && (
                    <p className="caption-style text-subtle">
                      Calculating score cards…
                    </p>
                  )}
                </div>
              </DetailSection>

              {error && (
                <div className="px-5 pb-5">
                  <p className="caption-style text-danger">{error}</p>
                </div>
              )}
            </ScrollArea>
          )}

          <SheetFooter>
            <Button variant="link" size="none" href="/help" className="lead-style">
              Need help? Ask us.
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={deleteCompany}>
                Delete
              </Button>
              <Button variant="secondary" size="sm" href="/contacts">
                Contacts
              </Button>
              <Button variant="primary" size="sm" href="/deals">
                Deals
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
            <DialogDescription>
              Update the account profile. Pipeline metrics remain calculated from real deals.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save}>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Company name" htmlFor="edit-company-name" className="sm:col-span-2">
                <Input
                  id="edit-company-name"
                  value={edit.name}
                  onChange={(event) =>
                    setEdit((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Segment" htmlFor="edit-company-segment">
                <Select
                  value={edit.segment}
                  onValueChange={(value) =>
                    setEdit((current) => ({
                      ...current,
                      segment: value as Segment,
                    }))
                  }
                >
                  <SelectTrigger id="edit-company-segment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((segment) => (
                      <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Relationship" htmlFor="edit-company-stage">
                <Select
                  value={edit.stage}
                  onValueChange={(value) =>
                    setEdit((current) => ({ ...current, stage: value as Stage }))
                  }
                >
                  <SelectTrigger id="edit-company-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Owner" htmlFor="edit-company-owner" className="sm:col-span-2">
                <Select
                  value={edit.ownerSubject || "automatic"}
                  onValueChange={(value) =>
                    setEdit((current) => ({
                      ...current,
                      ownerSubject: value === "automatic" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-company-owner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Me</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member._id} value={member.userSubject}>
                        {member.name || member.email || "CRM member"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Last interaction date" htmlFor="edit-company-interaction-date">
                <Input
                  id="edit-company-interaction-date"
                  type="date"
                  value={edit.interactionDate}
                  onChange={(event) =>
                    setEdit((current) => ({
                      ...current,
                      interactionDate: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Interaction type" htmlFor="edit-company-interaction-type">
                <Select
                  value={edit.interactionType}
                  onValueChange={(value) =>
                    setEdit((current) => ({ ...current, interactionType: value }))
                  }
                >
                  <SelectTrigger id="edit-company-interaction-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {error && (
                <p className="caption-style text-danger sm:col-span-2">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="subtle" size="sm" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
