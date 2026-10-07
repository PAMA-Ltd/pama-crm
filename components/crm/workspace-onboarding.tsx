"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  acceptOrganizationInvite,
  createOrganization,
  listPendingOrganizationInvites,
} from "@/lib/convex/organizations";

export default function WorkspaceOnboarding() {
  const create = useMutation(createOrganization);
  const accept = useMutation(acceptOrganizationInvite);
  const invites = useQuery(listPendingOrganizationInvites, {}) ?? [];
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await create({ name, slug: slug.trim() || undefined });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create workspace.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function acceptInvite(inviteId: string) {
    setAcceptingId(inviteId);
    setError(null);
    try {
      await accept({ inviteId });
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Unable to accept invite.",
      );
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <main className="bg-background text-foreground flex h-dvh flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-lg flex-col gap-4">
        {invites.length > 0 && (
          <section className="border-line-strong bg-card rounded-xl border p-6">
            <h1>Workspace invitations</h1>
            <p className="text-soft mt-2 leading-5">
              Join an organization you have been invited to.
            </p>
            <div className="mt-5 space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite._id}
                  className="border-border flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {invite.organizationName}
                    </p>
                    <p className="caption-style text-subtle mt-1 capitalize">
                      {invite.role} · {invite.email}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={acceptingId === invite._id}
                    onClick={() => void acceptInvite(invite._id)}
                  >
                    {acceptingId === invite._id ? "Joining…" : "Join"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <form
          onSubmit={submit}
          className="border-line-strong bg-card flex flex-col gap-5 rounded-xl border p-6"
        >
          <div>
            <h1>Create a CRM workspace</h1>
            <p className="text-soft mt-2 leading-5">
              Use one workspace per business, for example Pamastore or Vasta.
            </p>
          </div>
          <Field label="Organization name" htmlFor="workspace-name" required>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pamastore"
              required
              autoFocus={invites.length === 0}
            />
          </Field>
          <Field label="Slug" htmlFor="workspace-slug">
            <Input
              id="workspace-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="pamastore"
            />
          </Field>
          {error && (
            <p role="alert" className="caption-style text-danger">
              {error}
            </p>
          )}
          <Button variant="primary" size="md" type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </main>
  );
}
