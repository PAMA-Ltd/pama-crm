"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import { Input } from "@/components/_ui/input";
import PageHeader from "@/components/crm/page-header";
import EmptyState from "@/components/crm/empty-state";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { createPipeline, listPipelines } from "@/lib/convex/pipelines";
import { formatMoney } from "@/lib/companies";

export default function PipelinesPage() {
  const { organization } = useWorkspace();
  const pipelines =
    useQuery(listPipelines, { organizationId: organization._id }) ?? [];
  const create = useMutation(createPipeline);
  const [name, setName] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await create({ organizationId: organization._id, name });
    setName("");
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="Pipelines" description="Deal pipelines for this workspace" />
      <div className="border-border flex shrink-0 border-b p-4">
        <form onSubmit={submit} className="flex w-full max-w-lg gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New pipeline name"
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={!name.trim()}
          >
            Add pipeline
          </Button>
        </form>
      </div>
      {pipelines.length === 0 ? (
        <EmptyState
          title="No pipelines"
          description="Create a pipeline to group your deals."
        />
      ) : (
        <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <article
              key={pipeline._id}
              className="border-line-strong bg-card rounded-xl border p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2>{pipeline.name}</h2>
                {pipeline.isDefault && (
                  <span className="caption-style text-subtle">Default</span>
                )}
              </div>
              <p className="mt-4 text-xl font-semibold tabular-nums">
                ${formatMoney(pipeline.openValue)}
              </p>
              <p className="caption-style text-subtle mt-1">
                {pipeline.dealCount}{" "}
                {pipeline.dealCount === 1 ? "deal" : "deals"}
              </p>
              <Button
                href={`/deals?pipeline=${pipeline._id}`}
                variant="secondary"
                size="sm"
                className="mt-4"
              >
                Open board
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
