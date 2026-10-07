import SegmentBar from "@/components/_common/segment-bar";
import type { Company } from "@/data/companies";
import type { CrmDeal } from "@/lib/convex/deals";
import { formatMoney } from "@/lib/companies";

type PipelineHealthProps = {
  company: Company;
  deals: CrmDeal[];
};

export default function PipelineHealth({
  company,
  deals,
}: PipelineHealthProps) {
  const stages = [
    {
      label: "Discovery",
      deals: deals.filter(
        (deal) => deal.stage === "Lead" || deal.stage === "Qualified",
      ),
      tone: "danger" as const,
    },
    {
      label: "Evaluation",
      deals: deals.filter((deal) => deal.stage === "Proposal"),
      tone: "warning" as const,
    },
    {
      label: "Procurement",
      deals: deals.filter(
        (deal) => deal.stage === "Negotiation" || deal.stage === "Won",
      ),
      tone: "success" as const,
    },
  ].map((group) => {
    const value = group.deals.reduce((sum, deal) => sum + deal.amount, 0);
    const probability = group.deals.length
      ? Math.round(
          group.deals.reduce((sum, deal) => sum + deal.probability, 0) /
            group.deals.length,
        )
      : 0;
    return { ...group, value, probability };
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="block text-[28px] leading-none font-semibold">
          {company.winProbability}%
        </span>
        <span className="caption-style block text-soft">
          Weighted win probability · ${formatMoney(company.pipelineValue)} open
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {stages.map((stage) => (
          <div key={stage.label} className="flex flex-col gap-2">
            <div className="caption-style flex items-center justify-between gap-3">
              <span>{stage.label}</span>
              <span className="tabular-nums">
                {stage.deals.length} · {stage.probability}% · $
                {formatMoney(stage.value)}
              </span>
            </div>
            <SegmentBar
              percent={stage.probability}
              segments={63}
              tone={stage.tone}
              className="h-3 w-full border border-white/4 px-px"
              segmentClassName="h-2"
              trackClassName="bg-white/8"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
