"use client";

import type { ReactNode } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Button from "@/components/_ui/button";
import { useCompaniesStore } from "@/stores/companies-store";
import MenuIcon from "@/public/assets/images/_common/menu.svg";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  const { user } = useUser();
  const setSidebarOpen = useCompaniesStore((state) => state.setSidebarOpen);

  return (
    <header className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon aria-hidden className="size-3.5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate">{title}</h1>
          {description && (
            <p className="caption-style text-subtle mt-1 truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <div className="caption-style border-border bg-card flex h-[30px] items-center gap-1.5 rounded-md border py-[4px] pr-[7px] pl-[4px]">
          <UserButton />
          <span className="hidden max-w-[140px] truncate sm:inline">
            {user?.fullName ??
              user?.primaryEmailAddress?.emailAddress ??
              "Account"}
          </span>
        </div>
      </div>
    </header>
  );
}
