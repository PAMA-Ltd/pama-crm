import type { ScoreCard as ScoreCardData } from "@/data/companies";
import SegmentBar from "@/components/_common/segment-bar";

export default function ScoreCard({ card }: { card: ScoreCardData }) {
  return (
    <article className="bg-card ease-power3-out flex flex-col gap-4 rounded-lg p-4 shadow-[0px_4px_4px_0px_rgba(42,42,42,0.32),0px_0px_0px_1px_#0e0e0e,inset_0px_1px_0px_0px_rgba(255,255,255,0.08),inset_0px_0px_0px_1px_rgba(255,255,255,0.08)] transition-colors duration-150 hover:bg-[#252525]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3>{card.title}</h3>
          <span className="lead-style tabular-nums">{card.score}%</span>
        </div>
        <p className="text-soft">{card.description}</p>
      </div>
      <div className="caption-style flex items-center justify-between gap-3">
        <span>{card.verdict}</span>
        <SegmentBar percent={card.score} className="w-[88px]" />
      </div>
    </article>
  );
}
