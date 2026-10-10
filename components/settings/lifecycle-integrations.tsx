"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import { createLifecycleIntegration, listLifecycleIntegrations, listLifecycleIngressAudit, revokeLifecycleIntegration } from "@/lib/convex/lifecycle";
import { validIntegrationSource } from "@/lib/lifecycle/event-contract";

type Role = "owner" | "admin" | "member";

export default function LifecycleIntegrations({ organizationId, role }: { organizationId: string; role: Role }) {
  const admin = role !== "member";
  const settings = useQuery(getWorkspaceSettings, { organizationId });
  const integrations = useQuery(listLifecycleIntegrations, admin ? { organizationId } : "skip");
  const audit = useQuery(listLifecycleIngressAudit, admin ? { organizationId, limit: 20 } : "skip");
  const register = useMutation(createLifecycleIntegration);
  const revoke = useMutation(revokeLifecycleIntegration);
  const [source, setSource] = useState("pamastore");
  const [label, setLabel] = useState("Pamastore event publisher");
  const [environment, setEnvironment] = useState<"staging" | "production">("staging");
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = settings?.enabledModules.includes("lifecycle") ?? false;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!admin || !enabled || busy || !validIntegrationSource(source)) return;
    if (environment === "production" && !window.confirm("Create a PRODUCTION ingestion key? This key can publish customer events to this workspace. Keep it server-side.")) return;
    setError(null);
    setOneTimeToken(null);
    setBusy(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const raw = "pama_evt_" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      const tokenHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      await register({ organizationId, source, environment, label: label.trim(),
        tokenHash, tokenPrefix: raw.slice(0, 20), expiresAt: Date.now() + 89 * 86400000 });
      setOneTimeToken(raw);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create integration.");
    } finally { setBusy(false); }
  }

  async function remove(integrationId: string) {
    if (!window.confirm("Revoke this integration credential immediately?")) return;
    setError(null);
    try { await revoke({ organizationId, integrationId }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not revoke integration."); }
  }

  return <section className="border-line-strong bg-card rounded-xl border p-4">
    <h2>Lifecycle event integrations</h2>
    <p className="text-soft mt-2 leading-5">
      Products send signed-integration events to /api/events without accessing other workspace records.
      Credentials are stored as hashes and scoped to one source, environment and organization.
    </p>
    {!enabled ? <p className="caption-style text-subtle mt-3">Enable the Lifecycle module in Workspace layout before creating an integration.</p>
    : !admin ? <p className="caption-style text-subtle mt-3">Only workspace admins can manage integration credentials.</p>
    : <>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={e => void create(e)}>
        <label className="text-sm">Source
          <input className="border-line-strong bg-background mt-1 w-full rounded-lg border p-2"
            value={source} onChange={e => setSource(e.target.value.toLowerCase())} required maxLength={64} />
        </label>
        <label className="text-sm">Label
          <input className="border-line-strong bg-background mt-1 w-full rounded-lg border p-2"
            value={label} onChange={e => setLabel(e.target.value)} required maxLength={80} />
        </label>
        <label className="text-sm">Environment
          <select className="border-line-strong bg-background mt-1 w-full rounded-lg border p-2"
            value={environment} onChange={e => setEnvironment(e.target.value as "staging" | "production")}>
            <option value="staging">Staging</option><option value="production">Production</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="primary" size="md"
            disabled={busy || !validIntegrationSource(source) || !label.trim()}>
            {busy ? "Creating…" : "Create integration key"}
          </Button>
        </div>
      </form>
      {oneTimeToken && <div role="status" className="mt-4 rounded-lg border p-3">
        <p className="font-medium">Copy this key now — it will not be shown again.</p>
        <code className="mt-2 block break-all text-xs">{oneTimeToken}</code>
        <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(oneTimeToken)}>Copy key</Button>
      </div>}
      <p className="caption-style text-subtle mt-3">Integration keys expire after 90 days. Never place them in a client bundle or browser code.</p>
      {integrations?.map(key => <div key={key._id} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div className="min-w-0">
          <p className="font-medium">{key.label}</p>
          <p className="caption-style text-subtle">{key.source} · {key.environment} · {key.tokenPrefix}… ·
            {key.revokedAt ? " Revoked" : key.expiresAt <= renderedAt ? " Expired" : " Active"}</p>
        </div>
        {!key.revokedAt && <Button variant="secondary" size="sm" onClick={() => void remove(key._id)}>Revoke</Button>}
      </div>)}
      <div className="mt-5 border-t pt-4">
        <h3 className="font-medium">Recent ingestion audit</h3>
        {audit?.length ? audit.map(entry => <div key={entry._id}
          className="caption-style text-subtle mt-2 flex flex-wrap justify-between gap-2">
          <span>{entry.outcome === "accepted" ? "Accepted" : "Duplicate"} · {entry.eventId}</span>
          <time dateTime={new Date(entry.createdAt).toISOString()}>
            {new Date(entry.createdAt).toLocaleString()}
          </time>
        </div>) : <p className="caption-style text-subtle mt-2">No accepted or duplicate deliveries yet.</p>}
      </div>
    </>}
    {error && <p role="alert" className="caption-style text-danger mt-3">{error}</p>}
  </section>;
}
