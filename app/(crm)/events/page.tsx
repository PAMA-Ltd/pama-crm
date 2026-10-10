"use client";

import { useQuery } from "convex/react";
import PageHeader from "@/components/crm/page-header";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { listLifecycleEvents } from "@/lib/convex/lifecycle";

export default function LifecycleEventsPage() {
  const { organization } = useWorkspace();
  const events = useQuery(listLifecycleEvents, { organizationId: organization._id, limit: 100 });

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col">
    <PageHeader title="Lifecycle Events" description={organization.name} />
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl rounded-xl border p-4">
        <h2 className="font-medium">Recent received events</h2>
        <p className="caption-style text-subtle mt-2">
          Read-only ingestion history. Contacts and profiles remain organization-isolated.
        </p>
        {events === undefined ? <p role="status" className="mt-4">Loading events…</p> :
          events.length === 0 ? <p className="mt-4 text-subtle">No lifecycle events have been received yet.</p>
          : <div className="mt-4 space-y-2">{events.map(event =>
            <article key={event._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">{event.type}</p>
                <p className="caption-style text-subtle">{event.source} · {event.environment} · {event.eventId}</p>
              </div>
              <time className="caption-style text-subtle" dateTime={new Date(event.occurredAt).toISOString()}>
                {new Date(event.occurredAt).toLocaleString()}
              </time>
            </article>)}</div>}
      </div>
    </div>
  </section>;
}
