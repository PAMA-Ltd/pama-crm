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
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import {
  createContact,
  type ContactStatus,
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
  const { contacts, isLoading } = useContacts();
  const { companies } = useCompanies();
  const create = useMutation(createContact);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
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

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        title: form.title || undefined,
        companyId: form.companyId === "none" ? undefined : form.companyId,
        status: form.status,
        notes: form.notes || undefined,
      });
      setForm(EMPTY_FORM);
      setOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create contact.",
      );
    } finally {
      setSaving(false);
    }
  }

  const newContactButton = (
    <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
      New Contact
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Contacts"
        description="People attached to your accounts and opportunities"
        actions={newContactButton}
      />

      <div className="flex shrink-0 items-center justify-between gap-3 p-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search contacts…"
          className="max-w-sm"
        />
        <span className="caption-style text-subtle hidden sm:block">
          {visible.length} {visible.length === 1 ? "contact" : "contacts"}
        </span>
      </div>

      {isLoading ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Loading contacts…
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the people you are speaking with. Contacts can be linked to companies and deals."
          action={newContactButton}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto border-t border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((contact) => (
                <TableRow key={contact._id} className="hover:bg-card/60">
                  <TableCell>
                    <span className="font-medium">
                      {[contact.firstName, contact.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-soft">
                    {contact.companyId
                      ? companyById.get(contact.companyId) ?? "Unknown company"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-soft">
                    {contact.title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="border-line-strong bg-secondary inline-flex rounded-full border px-2 py-1 text-xs">
                      {contact.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a
                        className="hover:text-soft underline underline-offset-2"
                        href={`mailto:${contact.email}`}
                      >
                        {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <a
                        className="hover:text-soft underline underline-offset-2"
                        href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                      >
                        {contact.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {visible.length === 0 && (
            <div className="caption-style text-subtle flex h-28 items-center justify-center">
              No contacts match “{search}”.
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New contact</DialogTitle>
            <DialogDescription>
              Add a person to your CRM and optionally link them to a company.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit}>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <Field label="First name" htmlFor="contact-first-name">
                <Input
                  id="contact-first-name"
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Last name" htmlFor="contact-last-name">
                <Input
                  id="contact-last-name"
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="contact-phone">
                <Input
                  id="contact-phone"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </Field>
              <Field label="Role / title" htmlFor="contact-title">
                <Input
                  id="contact-title"
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                />
              </Field>
              <Field label="Status" htmlFor="contact-status">
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    update("status", value as ContactStatus)
                  }
                >
                  <SelectTrigger id="contact-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Company"
                htmlFor="contact-company"
                className="sm:col-span-2"
              >
                <Select
                  value={form.companyId}
                  onValueChange={(value) => update("companyId", value)}
                >
                  <SelectTrigger id="contact-company">
                    <SelectValue placeholder="No company" />
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
              <Field
                label="Notes"
                htmlFor="contact-notes"
                className="sm:col-span-2"
              >
                <textarea
                  id="contact-notes"
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                  rows={4}
                  className="border-line-strong bg-secondary text-foreground placeholder:text-subtle focus-visible:border-ring w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
                  placeholder="Context, preferences, next steps…"
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
                {saving ? "Creating…" : "Create contact"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
