import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="border-line-strong bg-card flex max-w-sm flex-col items-center gap-3 rounded-xl border p-6 text-center">
        <h2>{title}</h2>
        <p className="text-soft leading-5">{description}</p>
        {action}
      </div>
    </div>
  );
}
