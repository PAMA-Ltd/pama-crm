"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
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
import EmptyState from "@/components/crm/empty-state";
import PageHeader from "@/components/crm/page-header";
import SalesTabs from "@/components/crm/sales-tabs";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import {
  createDeal,
  DEAL_STAGES,
  removeDeal,
  updateDeal,
  updateDealStage,
  type CrmDeal,
  type DealStage,
} from "@/lib/convex/deals";
import { listPipelines } from "@/lib/convex/pipelines";
import { formatMoney } from "@/lib/companies";

const ACTIVE_STAGES: DealStage[] = [
  "Lead",
  "Qualified",
  "Proposal",
  "Negotiation",
];
const BOARD_STAGES: DealStage[] = [...ACTIVE_STAGES, "Won", "Lost"];

const EMPTY_FORM = {
  name: "",
  companyId: "",
  contactId: "none",
  pipelineId: "none",
  amount: "",
  stage: "Lead" as DealStage,
  expectedCloseDate: "",
  notes: "",
};

export default function DealsPage() {
  const searchParams = useSearchParams();
  const { organization } = useWorkspace();
  const requestedPipeline = searchParams.get("pipeline") ?? undefined;
  const { deals, isLoading } = useDeals(requestedPipeline);
  const { companies } = useCompanies();
  const { contacts } = useContacts();
  const pipelines =
    useQuery(listPipelines, { organizationId: organization._id }) ?? [];
  const create = useMutation(createDeal);
  const updateMutation = useMutation(updateDeal);
  const remove = useMutation(removeDeal);
  const setStage = useMutation(updateDealStage);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const contactsById = useMemo(
    () =>
      new Map(
        contacts.map((contact) => [
          contact._id,
          [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        ]),
      ),
    [contacts],
  );

  const matchingContacts = form.companyId
    ? contacts.filter(
        (contact) =>
          !contact.companyId || contact.companyId === form.companyId,
      )
    : [];

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "companyId" ? { contactId: "none" } : null),
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      pipelineId:
        requestedPipeline ??
        pipelines.find((pipeline) => pipeline.isDefault)?._id ??
        "none",
    });
    setError(null);
    setOpen(true);
  }

  function openEdit(deal: CrmDeal) {
    setEditingId(deal._id);
    setForm({
      name: deal.name,
      companyId: deal.companyId,
      contactId: deal.contactId ?? "none",
      pipelineId: deal.pipelineId ?? "none",
      amount: String(deal.amount),
      stage: deal.stage,
      expectedCloseDate: deal.expectedCloseDate ?? "",
      notes: deal.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.companyId) {
      setError("Select a company for this deal.");
      return;
    }

    const payload = {
      organizationId: organization._id,
      name: form.name,
      companyId: form.companyId,
      contactId: form.contactId === "none" ? undefined : form.contactId,
      pipelineId: form.pipelineId === "none" ? undefined : form.pipelineId,
      amount: Number(form.amount) || 0,
      stage: form.stage,
      expectedCloseDate: form.expectedCloseDate || undefined,
      notes: form.notes || undefined,
    };

    setError(null);
    setSaving(true);
    try {
      if (editingId) {
        await updateMutation({ ...payload, dealId: editingId });
      } else {
        await create(payload);
      }
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to save deal.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveDeal(dealId: string, stage: DealStage) {
    setMovingId(dealId);
    try {
      await setStage({
        organizationId: organization._id,
        dealId,
        stage,
      });
    } finally {
      setMovingId(null);
    }
  }

  async function deleteDeal(deal: CrmDeal) {
    if (!window.confirm(`Delete ${deal.name}?`)) return;
    try {
      await remove({
        organizationId: organization._id,
        dealId: deal._id,
      });
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error ? deleteError.message : "Unable to delete deal.",
      );
    }
  }

  const openPipeline = deals.filter((deal) =>
    ACTIVE_STAGES.includes(deal.stage),
  );
  const pipelineValue = openPipeline.reduce(
    (total, deal) => total + deal.amount,
    0,
  );

  const newDealButton = (
    <Button
      variant="primary"
      size="sm"
      onClick={openCreate}
      disabled={companies.length === 0}
    >
      New Deal
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Deals"
        description={`${openPipeline.length} open · ${formatMoney(pipelineValue)} pipeline`}
        actions={newDealButton}
      />
      <SalesTabs />

      {requestedPipeline && (
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
          <p className="caption-style text-subtle">
            Pipeline:{" "}
            {pipelines.find((pipeline) => pipeline._id === requestedPipeline)?.name ??
              "Selected pipeline"}
          </p>
          <Button href="/deals" variant="ghost" size="sm">
            Clear pipeline
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Loading deals…
        </div>
      ) : companies.length === 0 ? (
        <EmptyState
          title="Create a company first"
          description="Every deal belongs to a company, so add your first account before opening an opportunity."
          action={<Button href="/companies" variant="primary" size="sm">Go to companies</Button>}
        />
      ) : deals.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Create your first opportunity and move it through the pipeline as the conversation progresses."
          action={newDealButton}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="grid h-full min-w-[1220px] grid-cols-6 gap-3">
            {BOARD_STAGES.map((stage) => {
              const stageDeals = deals.filter((deal) => deal.stage === stage);
              const total = stageDeals.reduce((sum, deal) => sum + deal.amount, 0);

              return (
                <section
                  key={stage}
                  className="border-line-strong bg-sidebar flex min-h-0 flex-col rounded-xl border"
                >
                  <div className="border-border border-b p-3">
                    <h2 className="text-sm">{stage}</h2>
                    <p className="caption-style text-subtle mt-1">
                      {stageDeals.length} · ${formatMoney(total)}
                    </p>
                  </div>

                  <div className="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                    {stageDeals.length === 0 ? (
                      <div className="caption-style text-subtle flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
                        No deals
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <article
                          key={deal._id}
                          className="border-line-strong bg-card flex flex-col gap-3 rounded-lg border p-3"
                        >
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => openEdit(deal)}
                          >
                            <h3 className="truncate text-sm font-medium">{deal.name}</h3>
                            <p className="caption-style text-subtle mt-1 truncate">
                              {companyById.get(deal.companyId) ?? "Unknown company"}
                            </p>
                          </button>

                          <div className="flex items-end justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium tabular-nums">
                                ${formatMoney(deal.amount)}
                              </p>
                              <p className="caption-style text-subtle mt-1">
                                {deal.probability}% probability
                              </p>
                            </div>
                            {deal.expectedCloseDate && (
                              <span className="caption-style text-soft">
                                {deal.expectedCloseDate}
                              </span>
                            )}
                          </div>

                          {deal.contactId && (
                            <p className="caption-style text-soft truncate">
                              {contactsById.get(deal.contactId) ?? "Contact"}
                            </p>
                          )}

                          <Select
                            value={deal.stage}
                            onValueChange={(value) =>
                              void moveDeal(deal._id, value as DealStage)
                            }
                            disabled={movingId === deal._id}
                          >
                            <SelectTrigger aria-label={`Move ${deal.name} to another stage`} className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEAL_STAGES.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(deal)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void deleteDeal(deal)}>
                              Delete
                            </Button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit deal" : "New deal"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update opportunity details, pipeline and stage."
                : "Open an opportunity against an existing company."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit}>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Deal name" htmlFor="deal-name" className="sm:col-span-2" required>
                <Input
                  id="deal-name"
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  required
                  autoFocus
                />
              </Field>

              <Field label="Company" htmlFor="deal-company" className="sm:col-span-2" required>
                <Select
                  value={form.companyId || undefined}
                  onValueChange={(value) => updateForm("companyId", value)}
                >
                  <SelectTrigger id="deal-company"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Contact" htmlFor="deal-contact">
                <Select
                  value={form.contactId}
                  onValueChange={(value) => updateForm("contactId", value)}
                  disabled={!form.companyId}
                >
                  <SelectTrigger id="deal-contact"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {matchingContacts.map((contact) => (
                      <SelectItem key={contact._id} value={contact._id}>
                        {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Pipeline" htmlFor="deal-pipeline">
                <Select
                  value={form.pipelineId}
                  onValueChange={(value) => updateForm("pipelineId", value)}
                >
                  <SelectTrigger id="deal-pipeline"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No pipeline</SelectItem>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline._id} value={pipeline._id}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Stage" htmlFor="deal-stage">
                <Select
                  value={form.stage}
                  onValueChange={(value) => updateForm("stage", value as DealStage)}
                >
                  <SelectTrigger id="deal-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEAL_STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Value" htmlFor="deal-value" required>
                <Input
                  id="deal-value"
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(event) => updateForm("amount", event.target.value)}
                  required
                />
              </Field>

              <Field label="Expected close" htmlFor="deal-close">
                <Input
                  id="deal-close"
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(event) => updateForm("expectedCloseDate", event.target.value)}
                />
              </Field>

              <Field label="Notes" htmlFor="deal-notes" className="sm:col-span-2">
                <textarea
                  id="deal-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  rows={5}
                  className="border-line-strong bg-secondary text-foreground w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </Field>

              {error && (
                <p role="alert" className="caption-style text-danger sm:col-span-2">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="subtle" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save deal" : "Create deal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
