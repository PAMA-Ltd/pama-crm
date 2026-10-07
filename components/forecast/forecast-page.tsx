"use client";

import { useMemo } from "react";
import PageHeader from "@/components/crm/page-header";
import EmptyState from "@/components/crm/empty-state";
import Button from "@/components/_ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { useDeals } from "@/hooks/use-deals";
import { DEAL_STAGES, type DealStage } from "@/lib/convex/deals";
import { formatMoney } from "@/lib/companies";

const OPEN_STAGES: DealStage[] = [
  "Lead",
  "Qualified",
  "Proposal",
  "Negotiation",
];

export default function ForecastPage() {
  const { deals, isLoading } = useDeals();

  const metrics = useMemo(() => {
    const open = deals.filter((deal) => OPEN_STAGES.includes(deal.stage));
    const won = deals.filter((deal) => deal.stage === "Won");
    const lost = deals.filter((deal) => deal.stage === "Lost");

    const pipeline = open.reduce((sum, deal) => sum + deal.amount, 0);
    const weighted = open.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    );
    const wonValue = won.reduce((sum, deal) => sum + deal.amount, 0);
    const closed = won.length + lost.length;
    const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : 0;

    return {
      pipeline,
      weighted,
      wonValue,
      openCount: open.length,
      wonCount: won.length,
      winRate,
    };
  }, [deals]);

  const stageRows = DEAL_STAGES.map((stage) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    const total = stageDeals.reduce((sum, deal) => sum + deal.amount, 0);
    const weighted = stageDeals.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    );
    return { stage, count: stageDeals.length, total, weighted };
  });

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Forecast"
        description="Live roll-up from your deal pipeline"
      />

      {isLoading ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Calculating forecast…
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          title="No forecast yet"
          description="Forecast is calculated automatically from your deals. Create opportunities first and this screen will update in real time."
          action={
            <Button href="/deals" variant="primary" size="sm">
              Go to deals
            </Button>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="Open pipeline"
                value={`$${formatMoney(metrics.pipeline)}`}
                detail={`${metrics.openCount} open deals`}
              />
              <MetricCard
                label="Weighted forecast"
                value={`$${formatMoney(Math.round(metrics.weighted))}`}
                detail="Value × probability"
              />
              <MetricCard
                label="Won revenue"
                value={`$${formatMoney(metrics.wonValue)}`}
                detail={`${metrics.wonCount} won deals`}
              />
              <MetricCard
                label="Win rate"
                value={`${metrics.winRate}%`}
                detail="Won ÷ closed deals"
              />
            </div>

            <section className="border-line-strong bg-card overflow-hidden rounded-xl border">
              <div className="border-border border-b p-4">
                <h2>Pipeline by stage</h2>
                <p className="caption-style text-subtle mt-1">
                  The weighted column is the amount multiplied by each deal’s
                  stage probability.
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stage</TableHead>
                      <TableHead>Deals</TableHead>
                      <TableHead>Total value</TableHead>
                      <TableHead>Weighted value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stageRows.map((row) => (
                      <TableRow key={row.stage}>
                        <TableCell className="font-medium">
                          {row.stage}
                        </TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell className="tabular-nums">
                          ${formatMoney(row.total)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          ${formatMoney(Math.round(row.weighted))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="border-line-strong bg-card rounded-xl border p-4">
      <p className="caption-style text-subtle">{label}</p>
      <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
      <p className="caption-style text-soft mt-2">{detail}</p>
    </article>
  );
}
