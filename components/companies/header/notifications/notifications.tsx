"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import CountBadge from "@/components/_ui/count-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/_ui/popover";
import { ScrollArea } from "@/components/_ui/scroll-area";
import { listNotifications } from "@/lib/convex/reports";
import { useWorkspace } from "@/components/crm/workspace-provider";
import BellIcon from "@/public/assets/images/companies/header/bell.svg";

export default function Notifications() {
  const router = useRouter();
  const { organization } = useWorkspace();
  const items = useQuery(listNotifications, {
    organizationId: organization._id,
    limit: 30,
  });
  const storageKey = `pama-crm:notifications:${organization._id}`;
  const [lastSeen, setLastSeen] = useState(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem(storageKey) ?? 0);
  });

  const notifications = useMemo(() => items ?? [], [items]);
  const unread = useMemo(
    () => notifications.filter((item) => item.createdAt > lastSeen),
    [notifications, lastSeen],
  );
  const overdue = notifications.filter((item) => item.overdue).length;

  function markAllRead() {
    const next = Date.now();
    window.localStorage.setItem(storageKey, String(next));
    setLastSeen(next);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon"
          aria-label={
            unread.length > 0
              ? `Notifications, ${unread.length} unread`
              : "Notifications"
          }
          className="data-[state=open]:bg-muted relative"
        >
          <BellIcon aria-hidden className="size-3.5" />
          {unread.length > 0 && (
            <span
              aria-hidden
              className="bg-danger ring-secondary absolute top-[7px] right-[7px] size-1.5 rounded-full ring-2"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(400px,calc(100vw-2rem))]">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <h2>Notifications</h2>
            {unread.length > 0 && <CountBadge>{unread.length}</CountBadge>}
            {overdue > 0 && (
              <span className="caption-style text-danger">{overdue} overdue</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread.length === 0}
            onClick={markAllRead}
            className="-mr-1.5"
          >
            Mark all as read
          </Button>
        </div>

        {notifications.length > 0 ? (
          <ScrollArea viewportClassName="max-h-[min(420px,60dvh)]">
            <ul className="flex flex-col gap-0.5 p-1.5">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Button
                    variant="item"
                    size="none"
                    className="p-3"
                    onClick={() => router.push("/activities")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">
                          {notification.title}
                        </span>
                        {notification.overdue && (
                          <span className="caption-style text-danger">Overdue</span>
                        )}
                      </span>
                      {notification.description && (
                        <span className="caption-style text-soft mt-1 block truncate">
                          {notification.description}
                        </span>
                      )}
                      <span className="caption-style text-subtle mt-1 block">
                        {notification.kind} ·{" "}
                        {new Intl.DateTimeFormat("en-NG", {
                          day: "numeric",
                          month: "short",
                        }).format(new Date(notification.createdAt))}
                      </span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="bg-muted flex size-10 items-center justify-center rounded-full shadow-[0px_0px_0px_1px_#232323]">
              <BellIcon aria-hidden className="text-soft size-4" />
            </span>
            <span className="lead-style mt-1 block font-medium">
              You’re all caught up
            </span>
            <span className="caption-style text-subtle block">
              CRM activity and overdue work will show up here.
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
