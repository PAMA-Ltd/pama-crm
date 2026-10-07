"use client";

import { useQuery } from "convex/react";
import PageHeader from "@/components/crm/page-header";
import EmptyState from "@/components/crm/empty-state";
import Button from "@/components/_ui/button";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { listSlippingDeals } from "@/lib/convex/reports";
import { useCompanies } from "@/hooks/use-companies";
import { formatMoney } from "@/lib/companies";

export default function SlippingDealsPage() {
  const { organization } = useWorkspace();
  const { companies } = useCompanies();
  const deals = useQuery(listSlippingDeals, {
    organizationId: organization._id,
    limit: 100,
  });
  const companyById = new Map(
    companies.map((company) => [company.id, company.name]),
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title="Slipping Deals"
        description="Open deals whose expected close date has passed"
      />
      {deals === undefined ? (
        <div className="caption-style text-subtle flex flex-1 items-center justify-center">
          Loading report…
        </div>
      ) : deals.length === 0 ? (
        <EmptyState
          title="Nothing is slipping"
          description="No open deal currently has an overdue close date."
          action={
            <Button href="/deals" variant="secondary" size="sm">
              View deals
            </Button>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl space-y-2">
            {deals.map((deal) => (
              <article
                key={deal._id}
                className="border-line-strong bg-card flex items-center justify-between gap-4 rounded-xl border p-4"
              >
                <div className="min-w-0">
                  <h2 className="truncate">{deal.name}</h2>
                  <p className="caption-style text-subtle mt-1">
                    {companyById.get(deal.companyId) ?? "Company"} · {deal.stage}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">
                    ${formatMoney(deal.amount)}
                  </p>
                  <p className="caption-style text-danger mt-1">
                    {deal.daysLate} days late
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
