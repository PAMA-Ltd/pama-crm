"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { createOrganization } from "@/lib/convex/organizations";

export default function WorkspaceOnboarding() {
  const create = useMutation(createOrganization);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
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

  return (
    <main className="bg-background text-foreground flex h-dvh flex-1 items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="border-line-strong bg-card flex w-full max-w-md flex-col gap-5 rounded-xl border p-6"
      >
        <div>
          <h1>Create your first CRM workspace</h1>
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
            autoFocus
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
    </main>
  );
}
