"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import Button from "@/components/_ui/button";
import PageHeader from "@/components/crm/page-header";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { claimLegacyData } from "@/lib/convex/organizations";

export default function SettingsPage() {
  const { organization } = useWorkspace();
  const claim = useMutation(claimLegacyData);
  const [result, setResult] = useState<string | null>(null);

  async function claimLegacy() {
    const counts = await claim({ organizationId: organization._id });
    setResult(
      `Claimed ${counts.companies} companies, ${counts.contacts} contacts, ${counts.deals} deals and ${counts.activities} activities.`,
    );
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
              onClick={claimLegacy}
            >
              Claim legacy records
            </Button>
            {result && (
              <p className="caption-style text-soft mt-3">{result}</p>
            )}
          </section>

          <section className="border-line-strong bg-card rounded-xl border p-4">
            <h2>ChatGPT / MCP</h2>
            <p className="text-soft mt-2 leading-5">
              MCP access is hosted by this same CRM at <code>/api/mcp</code>.
              Token management appears here once the MCP endpoint is enabled.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
