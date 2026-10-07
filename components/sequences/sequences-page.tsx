"use client";

import { useState, type FormEvent } from "react";
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
import PageHeader from "@/components/crm/page-header";
import EmptyState from "@/components/crm/empty-state";
import { useWorkspace } from "@/components/crm/workspace-provider";
import {
  createEmailSequence,
  listEmailSequences,
  type SequenceStatus,
} from "@/lib/convex/email-sequences";

export default function SequencesPage() {
  const { organization } = useWorkspace();
  const sequences =
    useQuery(listEmailSequences, { organizationId: organization._id }) ?? [];
  const create = useMutation(createEmailSequence);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delayDays, setDelayDays] = useState("0");
  const [status, setStatus] = useState<SequenceStatus>("draft");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await create({
        organizationId: organization._id,
        name,
        status,
        steps: [{ delayDays: Number(delayDays) || 0, subject, body }],
      });
      setOpen(false);
      setName("");
      setSubject("");
      setBody("");
      setDelayDays("0");
      setStatus("draft");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create sequence.",
      );
    } finally {
      setSaving(false);
    }
  }

  const createButton = (
    <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
      New Sequence
    </Button>
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Email Sequences"
        description="Reusable outreach plans for contacts"
        actions={createButton}
      />

      {sequences.length === 0 ? (
        <EmptyState
          title="No email sequences yet"
          description="Create a sequence plan and enroll CRM contacts. Sending stays disabled until a mail provider is configured."
          action={createButton}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sequences.map((sequence) => (
              <article
                key={sequence._id}
                className="border-line-strong bg-card rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate">{sequence.name}</h2>
                    <p className="caption-style text-subtle mt-1">
                      {sequence.steps.length}{" "}
                      {sequence.steps.length === 1 ? "step" : "steps"} ·{" "}
                      {sequence.enrollmentCount} enrolled
                    </p>
                  </div>
                  <span className="caption-style border-line-strong bg-secondary rounded-full border px-2 py-1 capitalize">
                    {sequence.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  {sequence.steps.map((step, index) => (
                    <div
                      key={`${sequence._id}-${index}`}
                      className="border-border rounded-lg border p-3"
                    >
                      <p className="text-sm font-medium">{step.subject}</p>
                      <p className="caption-style text-soft mt-1 line-clamp-2">
                        {step.body}
                      </p>
                      <p className="caption-style text-subtle mt-2">
                        Day {step.delayDays}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New email sequence</DialogTitle>
            <DialogDescription>
              Store a real outreach plan. Delivery starts only after a mail provider is configured.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit}>
            <div className="grid gap-4 p-6">
              <Field label="Sequence name" htmlFor="sequence-name" required>
                <Input
                  id="sequence-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="First email subject" htmlFor="sequence-subject" required>
                <Input
                  id="sequence-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  required
                />
              </Field>
              <Field label="Body" htmlFor="sequence-body" required>
                <textarea
                  id="sequence-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={6}
                  className="border-line-strong bg-secondary text-foreground w-full resize-y rounded-lg border px-3 py-2 text-sm outline-none"
                  required
                />
              </Field>
              <Field label="Delay days" htmlFor="sequence-delay">
                <Input
                  id="sequence-delay"
                  type="number"
                  min={0}
                  value={delayDays}
                  onChange={(event) => setDelayDays(event.target.value)}
                />
              </Field>
              <Field label="Status" htmlFor="sequence-status">
                <select
                  id="sequence-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as SequenceStatus)
                  }
                  className="border-line-strong bg-secondary text-foreground h-10 rounded-lg border px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>
              {error && <p className="caption-style text-danger">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="subtle" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create sequence"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
