import type { ComponentType, SVGProps } from "react";
import Sparkline from "@/components/_common/sparkline";
import type { CrmActivity } from "@/lib/convex/activities";
import CursorClickIcon from "@/public/assets/images/companies/detail/cursor-click.svg";
import MailIcon from "@/public/assets/images/companies/detail/mail-03.svg";
import CalendarIcon from "@/public/assets/images/companies/detail/calendar.svg";
import PhoneCallIcon from "@/public/assets/images/companies/detail/phone-call.svg";

type ActivityTrendProps = {
  trend: number[];
  activities: CrmActivity[];
};

type Stat = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
};

export default function ActivityTrend({
  trend,
  activities,
}: ActivityTrendProps) {
  const stats: Stat[] = [
    {
      icon: CursorClickIcon,
      label: "Total touches",
      value: activities.length,
    },
    {
      icon: MailIcon,
      label: "Emails",
      value: activities.filter((activity) => activity.type === "Email").length,
    },
    {
      icon: CalendarIcon,
      label: "Meetings",
      value: activities.filter((activity) => activity.type === "Meeting").length,
    },
    {
      icon: PhoneCallIcon,
      label: "Calls & notes",
      value: activities.filter(
        (activity) => activity.type === "Call" || activity.type === "Note",
      ).length,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-[3px]">
          <span className="block text-[24px] leading-none">{activities.length}</span>
          <Sparkline values={trend} className="h-[22px]" />
        </div>
        <span className="caption-style block text-soft">
          Real activity recorded for this company
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border-line-strong flex flex-col gap-3 rounded-lg border p-[11px]"
          >
            <span className="caption-style text-soft flex items-center gap-1">
              <stat.icon aria-hidden className="size-3 shrink-0" />
              {stat.label}
            </span>
            <span className="lead-style block">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
