"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import PageHeader from "@/components/crm/page-header";
import WorkspaceLayoutSettings from "./workspace-layout-settings";
import { useWorkspace } from "@/components/crm/workspace-provider";
import {
  claimLegacyData,
  createOrganization,
} from "@/lib/convex/organizations";
import {
  listMcpTokens,
  registerMcpToken,
  revokeMcpToken,
} from "@/lib/convex/mcp-tokens";

function randomMcpToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const encoded = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `pama_mcp_${encoded}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function SettingsPage() {
  const { organization } = useWorkspace();
  const claim = useMutation(claimLegacyData);
  const createWorkspace = useMutation(createOrganization);
  const registerToken = useMutation(registerMcpToken);
  const revokeToken = useMutation(revokeMcpToken);
  const tokens = useQuery(listMcpTokens, {}) ?? [];
  const [result, setResult] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("ChatGPT");
  const [tokenPermission, setTokenPermission] = useState<"read"|"write"|"admin">("write");
  const [tokenExpiryDays, setTokenExpiryDays] = useState(90);
  const [tokenWorkspaceOnly, setTokenWorkspaceOnly] = useState(true);
  const [creatingToken, setCreatingToken] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "/api/mcp";
    return `${window.location.origin}/api/mcp`;
  }, []);

  async function claimLegacy() {
    const counts = await claim({ organizationId: organization._id });
    setResult(
      `Claimed ${counts.companies} companies, ${counts.contacts} contacts, ${counts.deals} deals and ${counts.activities} activities.`,
    );
  }

  async function createToken() {
    setCreatingToken(true);
    try {
      const raw = randomMcpToken();
      const hash = await sha256Hex(raw);
      await registerToken({
        label: tokenLabel.trim() || "MCP access",
        tokenHash: hash,
        tokenPrefix: raw.slice(0, 20),
        permission: tokenPermission,
        expiresAt: Date.now() + tokenExpiryDays * 86400000,
        organizationId: tokenWorkspaceOnly ? organization._id : undefined,
      });
      setNewToken(raw);
    } finally {
      setCreatingToken(false);
    }
  }

  async function createAnotherWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkspaceError(null);
    try {
      await createWorkspace({
        name: workspaceName,
        slug: workspaceSlug.trim() || undefined,
      });
      setWorkspaceName("");
      setWorkspaceSlug("");
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Unable to create workspace.",
      );
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="Workspace Settings" description={organization.name} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <section className="border-line-strong bg-card rounded-xl border p-4">
            <h2>Organization</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="caption-style text-subtle">Name</dt>
                <dd className="mt-1">{organization.name}</dd>
              </div>
              <div>
                <dt className="caption-style text-subtle">Slug</dt>
                <dd className="mt-1">{organization.slug}</dd>
              </div>
              <div>
                <dt className="caption-style text-subtle">Plan</dt>
                <dd className="mt-1">{organization.planName}</dd>
              </div>
              <div>
                <dt className="caption-style text-subtle">Your role</dt>
                <dd className="mt-1 capitalize">{organization.role}</dd>
              </div>
            </dl>
          </section>

          <WorkspaceLayoutSettings
            key={organization._id}
            organizationId={organization._id}
            role={organization.role}
          />

          <section className="border-line-strong bg-card rounded-xl border p-4">
            <h2>Create another workspace</h2>
            <p className="text-soft mt-2 leading-5">
              Keep Pamastore, Vasta and other businesses isolated inside separate CRM organizations.
            </p>
            <form
              onSubmit={createAnotherWorkspace}
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <Field label="Name" htmlFor="new-workspace-name">
                <Input
                  id="new-workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Vasta"
                  required
                />
              </Field>
              <Field label="Slug" htmlFor="new-workspace-slug">
                <Input
                  id="new-workspace-slug"
                  value={workspaceSlug}
                  onChange={(event) => setWorkspaceSlug(event.target.value)}
                  placeholder="vasta"
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  size="md"
                  type="submit"
                  disabled={!workspaceName.trim()}
                >
                  Create
                </Button>
              </div>
            </form>
            {workspaceError && (
              <p className="caption-style text-danger mt-3">{workspaceError}</p>
            )}
          </section>

          <section className="border-line-strong bg-card rounded-xl border p-4">
            <h2>ChatGPT / MCP</h2>
            <p className="text-soft mt-2 leading-5">
              Connect an MCP client to this same CRM deployment. Each token uses
              your current organization memberships and permissions; changing or
              removing membership immediately changes what the token can access.
            </p>

            <div className="mt-4">
              <p className="caption-style text-subtle">Endpoint</p>
              <div className="mt-1 flex gap-2">
                <Input value={endpoint} readOnly />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.clipboard.writeText(endpoint)}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Token label" htmlFor="mcp-token-label" className="flex-1">
                <Input
                  id="mcp-token-label"
                  value={tokenLabel}
                  onChange={(event) => setTokenLabel(event.target.value)}
                  placeholder="ChatGPT"
                />
              </Field>
              <Button
                variant="primary"
                size="md"
                disabled={creatingToken}
                onClick={() => void createToken()}
              >
                {creatingToken ? "Creating…" : "Create MCP token"}
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm">Access level
                <select className="mt-1 w-full rounded-md border border-border bg-card p-2" value={tokenPermission} onChange={e=>setTokenPermission(e.target.value as "read"|"write"|"admin")}>
                  <option value="read">Read only</option><option value="write">Read / write</option><option value="admin">Administration</option>
                </select>
              </label>
              <label className="text-sm">Expiry
                <select className="mt-1 w-full rounded-md border border-border bg-card p-2" value={tokenExpiryDays} onChange={e=>setTokenExpiryDays(Number(e.target.value))}>
                  <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tokenWorkspaceOnly} onChange={e=>setTokenWorkspaceOnly(e.target.checked)}/> Limit to this workspace</label>
            </div>
            {newToken && (
              <div className="border-line-strong bg-secondary mt-4 rounded-lg border p-3">
                <p className="text-sm font-medium">Copy this token now</p>
                <p className="caption-style text-subtle mt-1">
                  For security it is stored only as a SHA-256 hash and cannot be shown again.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input value={newToken} readOnly className="font-mono text-xs" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void navigator.clipboard.writeText(newToken)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2">
              {tokens.length === 0 ? (
                <p className="caption-style text-subtle">
                  No MCP access tokens yet.
                </p>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token._id}
                    className="border-border flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{token.label}</p>
                      <p className="caption-style text-subtle mt-1 font-mono">
                        {token.tokenPrefix}… ·{" "}
                        {token.revokedAt ? "Revoked" : "Active"} · {token.permission ?? "legacy full"} · {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString() : "No expiry"}
                      </p>
                    </div>
                    {!token.revokedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void revokeToken({ tokenId: token._id })}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="border-line-strong bg-card rounded-xl border p-4">
            <h2>Legacy CRM migration</h2>
            <p className="text-soft mt-2 leading-5">
              If this workspace was created after the organization upgrade,
              claim older unscoped CRM records into it once.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => void claimLegacy()}
            >
              Claim legacy records
            </Button>
            {result && (
              <p className="caption-style text-soft mt-3">{result}</p>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
