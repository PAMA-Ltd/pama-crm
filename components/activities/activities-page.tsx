"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
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
import { useActivities } from "@/hooks/use-activities";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import {
  ACTIVITY_TYPES,
  createActivity,
  setActivityCompleted,
  type ActivityType,
} from "@/lib/convex/activities";

const EMPTY_FORM = {
  type: "Task" as ActivityType,
  subject: "",
  description: "",
  companyId: "none",
  contactId: "none",
  dealId: "none",
  dueDate: "",
};

function formatDue(timestamp?: number) {
  if (!timestamp) return "No due date";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export default function ActivitiesPage() {
  const { activities, isLoading } = useActivities();
  const { companies } = useCompanies();
  const { contacts } = useContacts();
  const { deals } = useDeals();
  const create = useMutation(createActivity);
  const setCompleted = useMutation(setActivityCompleted);
  const [open, setOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );
  const contactById = useMemo(
    () =>
      new Map(
        contacts.map((contact) => [
          contact._id,
          [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        ]),
      ),
    [contacts],
  );
  const dealById = useMemo(
    () => new Map(deals.map((deal) => [deal._id, deal.name])),
    [deals],
  );

  const visible = activities.filter((activity) =>
    showCompleted ? true : !activity.completedAt,
  );

  const matchingContacts =
    form.companyId === "none"
      ? contacts
      : contacts.filter(
          (contact) =>
            !contact.companyId || contact.companyId === form.companyId,
        );
  const matchingDeals =
    form.companyId === "none"
      ? deals
      : deals.filter((deal) => deal.companyId === form.companyId);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "companyId"
        ? { contactId: "none", dealId: "none" }
        : null),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await create({
        type: form.type,
        subject: form.subject,
        description: form.description || undefined,
        companyId: form.companyId === "none" ? undefined : form.companyId,
        contactId: form.contactId === "none" ? undefined : form.contactId,
        dealId: form.dealId === "none" ? undefined : form.dealId,
        dueAt: form.dueDate
          ? new Date(`${form.dueDate}T17:00:00`).getTime()
          : undefined,
      });
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create activity.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(activityId: string, completed: boolean) {
    setUpdatingId(activityId);
    try {
      await setCompleted({ activityId, completed });
    } finally {
      setUpdatingId(null);
    }
  }

  const newActivityButton = (
    <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
      New Activity
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Activities"
        description="Tasks, meetings, calls, emails and notes"
        actions={newActivityButton}
      />

      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-sm font-medium">
            {activities.filter((activity) => !activity.completedAt).length} open
          </p>
          <p className="caption-style text-subtle mt-1">
            Follow-ups stay attached to CRM records.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCompleted((value) => !value)}
        >
          {showCompleted ? "Hide completed" : "Show completed"}
        </Button>
      </div>

      {isLoading ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Loading activities…
        </div>
      ) : activities.length === 0 ? (
        <EmptyState
          title="No activities yet"
          description="Log calls and meetings, write notes, or create tasks with due dates."
          action={newActivityButton}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-2">
            {visible.map((activity) => (
              <article
                key={activity._id}
                className="border-line-strong bg-card flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border-line-strong bg-secondary inline-flex rounded-full border px-2 py-1 text-xs">
                      {activity.type}
                    </span>
                    <h2
                      className={
                        activity.completedAt
                          ? "text-soft line-through"
                          : undefined
                      }
                    >
                      {activity.subject}
                    </h2>
                  </div>

                  {activity.description && (
                    <p className="text-soft mt-2 leading-5">
                      {activity.description}
                    </p>
                  )}

                  <div className="caption-style text-subtle mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatDue(activity.dueAt)}</span>
                    {activity.companyId && (
                      <span>
                        {companyById.get(activity.companyId) ?? "Company"}
                      </span>
                    )}
                    {activity.contactId && (
                      <span>
                        {contactById.get(activity.contactId) ?? "Contact"}
                      </span>
                    )}
                    {activity.dealId && (
                      <span>{dealById.get(activity.dealId) ?? "Deal"}</span>
                    )}
                  </div>
                </div>

                <Button
                  variant={activity.completedAt ? "subtle" : "secondary"}
                  size="sm"
                  disabled={updatingId === activity._id}
                  onClick={() =>
                    toggle(activity._id, activity.completedAt === undefined)
                  }
                >
                  {activity.completedAt ? "Reopen" : "Mark done"}
                </Button>
              </article>
            ))}

            {visible.length === 0 && (
              <div className="caption-style text-subtle flex h-40 items-center justify-center">
                No open activities. You’re caught up.
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New activity</DialogTitle>
            <DialogDescription>
              Add a follow-up, interaction or note and link it to CRM records.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit}>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="Type" htmlFor="activity-type">
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    update("type", value as ActivityType)
                  }
                >
                  <SelectTrigger id="activity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Due date" htmlFor="activity-due">
                <Input
                  id="activity-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => update("dueDate", event.target.value)}
                />
              </Field>

              <Field
                label="Subject"
                htmlFor="activity-subject"
                className="sm:col-span-2"
                required
              >
                <Input
                  id="activity-subject"
                  value={form.subject}
                  onChange={(event) => update("subject", event.target.value)}
                  placeholder="Follow up on proposal…"
                  required
                  autoFocus
                />
              </Field>

              <Field label="Company" htmlFor="activity-company">
                <Select
                  value={form.companyId}
                  onValueChange={(value) => update("companyId", value)}
                >
                  <SelectTrigger id="activity-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Contact" htmlFor="activity-contact">
                <Select
                  value={form.contactId}
                  onValueChange={(value) => update("contactId", value)}
                >
                  <SelectTrigger id="activity-contact">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contact</SelectItem>
                    {matchingContacts.map((contact) => (
                      <SelectItem key={contact._id} value={contact._id}>
                        {[contact.firstName, contact.lastName]
                          .filter(Boolean)
                          .join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Deal"
                htmlFor="activity-deal"
                className="sm:col-span-2"
              >
                <Select
                  value={form.dealId}
                  onValueChange={(value) => update("dealId", value)}
                >
                  <SelectTrigger id="activity-deal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deal</SelectItem>
                    {matchingDeals.map((deal) => (
                      <SelectItem key={deal._id} value={deal._id}>
                        {deal.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Details"
                htmlFor="activity-description"
                className="sm:col-span-2"
              >
                <textarea
                  id="activity-description"
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows={4}
                  className="border-line-strong bg-secondary text-foreground placeholder:text-subtle focus-visible:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="What happened or what needs to happen next?"
                />
              </Field>

              {error && (
                <p
                  role="alert"
                  className="caption-style text-danger sm:col-span-2"
                >
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating…" : "Create activity"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
