import Asset from "@/components/_ui/asset";
import Button from "@/components/_ui/button";
import type { Company } from "@/data/companies";
import type { CrmNotification } from "@/lib/convex/reports";
import { cn } from "@/lib/utils";

type NotificationItemProps = {
  notification: CrmNotification;
  company?: Company;
  unread: boolean;
  onSelect: () => void;
};

function CompanyMark({
  company,
  className,
}: {
  company?: Company;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-muted flex shrink-0 items-center justify-center overflow-hidden shadow-[0px_0px_0px_1px_#232323]",
        className,
      )}
    >
      {company?.logo ? (
        <Asset
          type="image"
          src={company.logo}
          alt=""
          width={1}
          height={1}
          fit="contain"
          className="size-[60%]"
        />
      ) : (
        <span className="caption-style text-soft">
          {company?.name.slice(0, 1) ?? "?"}
        </span>
      )}
    </span>
  );
}

export default function NotificationItem({
  notification,
  company,
  unread,
  onSelect,
}: NotificationItemProps) {
  const actorInitial = notification.actorName?.slice(0, 1).toUpperCase();

  return (
    <li className="relative">
      <Button
        variant="item"
        size="none"
        onClick={onSelect}
        data-unread={unread}
        className="p-3 data-[unread=true]:bg-white/2 data-[unread=true]:hover:bg-white/5"
      >
        <span className="relative mt-px shrink-0">
          {notification.actorName ? (
            <>
              <span className="bg-muted text-soft flex size-8 items-center justify-center overflow-hidden rounded-full outline-1 -outline-offset-1 outline-white/10">
                {notification.actorAvatarUrl ? (
                  <Asset
                    type="image"
                    src={notification.actorAvatarUrl}
                    alt=""
                    width={1}
                    height={1}
                    fit="cover"
                    className="size-full"
                  />
                ) : (
                  <span className="caption-style">{actorInitial}</span>
                )}
              </span>
              <CompanyMark
                company={company}
                className="ring-popover absolute -right-1 -bottom-1 size-4 rounded-[5px] ring-2"
              />
            </>
          ) : (
            <CompanyMark company={company} className="size-8 rounded-lg" />
          )}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-2 pr-4">
          <span className="p-style text-soft block">
            {notification.actorName && (
              <span className="text-foreground font-medium">
                {notification.actorName}{" "}
              </span>
            )}
            {notification.title}
          </span>
          {notification.description && (
            <span className="p-style border-line-strong text-soft block rounded-lg border bg-white/3 px-3 py-2">
              {notification.description}
            </span>
          )}
          <span className="caption-style text-subtle flex items-center gap-1.5">
            {new Intl.DateTimeFormat("en-NG", {
              day: "numeric",
              month: "short",
            }).format(new Date(notification.createdAt))}
            {company && (
              <>
                <span aria-hidden className="bg-subtle size-0.5 rounded-full" />
                {company.name}
              </>
            )}
            <span aria-hidden className="bg-subtle size-0.5 rounded-full" />
            {notification.kind}
            {notification.overdue && (
              <>
                <span aria-hidden className="bg-subtle size-0.5 rounded-full" />
                <span className="text-danger">Overdue</span>
              </>
            )}
          </span>
        </span>

        {unread && <span className="sr-only">Unread</span>}
      </Button>
      {unread && (
        <span
          aria-hidden
          className="bg-danger pointer-events-none absolute top-4 right-3 size-1.5 rounded-full"
        />
      )}
    </li>
  );
}
