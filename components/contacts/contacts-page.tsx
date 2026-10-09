"use client";

import { useMemo, useState, type FormEvent } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import EmptyState from "@/components/crm/empty-state";
import PageHeader from "@/components/crm/page-header";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import { WORKSPACE_PRESETS } from "@/lib/workspaces/presets";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import { useActivities } from "@/hooks/use-activities";
import {
  createContact,
  removeContact,
  updateContact,
  type ContactStatus,
  type CrmContact,
} from "@/lib/convex/contacts";

const STATUSES: ContactStatus[] = ["Lead", "Active", "Customer", "Inactive"];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  title: "",
  companyId: "none",
  status: "Lead" as ContactStatus,
  notes: "",
};

export default function ContactsPage() {
  const { organization } = useWorkspace();
  const layout = useQuery(getWorkspaceSettings, { organizationId: organization._id });
  const peopleLabel = layout ? WORKSPACE_PRESETS[layout.preset].contactLabel : "Contacts";
  const personLabel = peopleLabel === "People" ? "Person" : peopleLabel.slice(0, -1);
  const salesVisible = layout?.enabledModules.includes("sales") ?? false;
  const { contacts, isLoading } = useContacts();
  const { companies } = useCompanies();
  const { deals } = useDeals();
  const { activities } = useActivities();
  const create = useMutation(createContact);
  const updateMutation = useMutation(updateContact);
  const remove = useMutation(removeContact);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const company = contact.companyId
        ? companyById.get(contact.companyId) ?? ""
        : "";
      return [
        contact.firstName,
        contact.lastName,
        contact.email ?? "",
        contact.phone ?? "",
        contact.title ?? "",
        company,
        contact.status,
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [contacts, search, companyById]);

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(contact: CrmContact) {
    setEditingId(contact._id);
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      title: contact.title ?? "",
      companyId: contact.companyId ?? "none",
      status: contact.status,
      notes: contact.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      organizationId: organization._id,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      title: form.title || undefined,
      companyId: form.companyId === "none" ? undefined : form.companyId,
      status: form.status,
      notes: form.notes || undefined,
    };

    try {
      if (editingId) {
        await updateMutation({ ...payload, contactId: editingId });
      } else {
        await create(payload);
      }
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save contact.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contact: CrmContact) {
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
    if (!window.confirm(`Delete ${name || "this contact"}?`)) return;
    try {
      await remove({
        organizationId: organization._id,
        contactId: contact._id,
      });
    } catch (deleteError) {
      window.alert(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete contact.",
      );
    }
  }

  const newContactButton = (
    <Button variant="primary" size="sm" onClick={openCreate}>
      {`New ${personLabel}`}
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title={peopleLabel}
        description={salesVisible ? "People attached to your accounts and opportunities" : "People and relationships in this workspace"}
        actions={newContactButton}
      />

      <div className="flex shrink-0 items-center justify-between gap-3 p-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={`Search ${peopleLabel.toLowerCase()}…`}
          className="max-w-sm"
        />
        <span className="caption-style text-subtle hidden sm:block">
          {visible.length} {visible.length === 1 ? personLabel.toLowerCase() : peopleLabel.toLowerCase()}
        </span>
      </div>

      {isLoading ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Loading {peopleLabel.toLowerCase()}…
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title={`No ${peopleLabel.toLowerCase()} yet`}
          description={salesVisible
            ? "Add the people you are speaking with. Contacts can be linked to companies and deals."
            : "Add people to your workspace. You can optionally enable Sales later without losing records."}
          action={newContactButton}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {salesVisible && <TableHead>Company</TableHead>}
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                {salesVisible && <TableHead>Deals</TableHead>}
                <TableHead>Activities</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((contact) => {
                const dealCount = deals.filter(
                  (deal) => deal.contactId === contact._id,
                ).length;
                const activityCount = activities.filter(
                  (activity) => activity.contactId === contact._id,
                ).length;

                return (
                  <TableRow
                    key={contact._id}
                    className="hover:bg-card/60 cursor-pointer"
                    onClick={() => openEdit(contact)}
                  >
                    <TableCell>
                      <div className="min-w-0">
                        <span className="font-medium">
                          {[contact.firstName, contact.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </span>
                        <p className="caption-style text-subtle mt-1">
                          {contact.email ?? contact.phone ?? "No contact details"}
                        </p>
                      </div>
                    </TableCell>
                    {salesVisible && <TableCell className="text-soft">
                      {contact.companyId
                        ? companyById.get(contact.companyId) ?? "Unknown company"
                        : "—"}
                    </TableCell>}
                    <TableCell className="text-soft">
                      {contact.title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="border-line-strong bg-secondary inline-flex rounded-full border px-2 py-1 text-xs">
                        {contact.status}
                      </span>
                    </TableCell>
                    {salesVisible && <TableCell>{dealCount}</TableCell>}
                    <TableCell>{activityCount}</TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(contact)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void deleteContact(contact)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? `Edit ${personLabel.toLowerCase()}` : `New ${personLabel.toLowerCase()}`}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update this person and their relationship to the organization."
                : salesVisible
                  ? "Add a person to your CRM and optionally link them to a company."
                  : "Add a person to this workspace."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit}>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="First name" htmlFor="contact-first-name">
                <Input
                  id="contact-first-name"
                  value={form.firstName}
                  onChange={(event) => updateForm("firstName", event.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Last name" htmlFor="contact-last-name">
                <Input
                  id="contact-last-name"
                  value={form.lastName}
                  onChange={(event) => updateForm("lastName", event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                />
              </Field>
              <Field label="Role / title" htmlFor="contact-title">
                <Input
                  id="contact-title"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                />
              </Field>
              <Field label="Status" htmlFor="contact-status">
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    updateForm("status", value as ContactStatus)
                  }
                >
                  <SelectTrigger id="contact-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {salesVisible && <Field label="Company" htmlFor="contact-company" className="sm:col-span-2">
                <Select
                  value={form.companyId}
                  onValueChange={(value) => updateForm("companyId", value)}
                >
                  <SelectTrigger id="contact-company"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>}
              <Field label="Notes" htmlFor="contact-notes" className="sm:col-span-2">
                <textarea
                  id="contact-notes"
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  rows={5}
                  className="border-line-strong bg-secondary text-foreground w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="Context, preferences, next steps…"
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
                {saving ? "Saving…" : editingId ? `Save ${personLabel.toLowerCase()}` : `Create ${personLabel.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
