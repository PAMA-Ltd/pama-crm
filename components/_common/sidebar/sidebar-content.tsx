"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import OrganizationSwitcher from "@/components/crm/organization-switcher";
import SidebarNavItem from "./sidebar-nav-item";
import SidebarSection from "./sidebar-section";
import { useCompanies } from "@/hooks/use-companies";
import { useContacts } from "@/hooks/use-contacts";
import { useDeals } from "@/hooks/use-deals";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { listTeams } from "@/lib/convex/teams";
import { listPipelines } from "@/lib/convex/pipelines";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import { WORKSPACE_PRESETS } from "@/lib/workspaces/presets";
import Logo from "@/public/assets/images/_common/logo.svg";
import BuildingIcon from "@/public/assets/images/companies/sidebar/building.svg";
import ClipboardIcon from "@/public/assets/images/companies/sidebar/clipboard.svg";
import BarChartIcon from "@/public/assets/images/companies/sidebar/bar-chart.svg";
import ListIcon from "@/public/assets/images/companies/sidebar/list.svg";
import BookClosedIcon from "@/public/assets/images/companies/sidebar/book-closed.svg";
import MailIcon from "@/public/assets/images/companies/sidebar/mail.svg";
import TargetIcon from "@/public/assets/images/companies/sidebar/target-05.svg";
import TargetAltIcon from "@/public/assets/images/companies/sidebar/target-03.svg";
import UsersIcon from "@/public/assets/images/companies/sidebar/users.svg";
import BarChartAltIcon from "@/public/assets/images/companies/sidebar/bar-chart-10.svg";
import AlertTriangleIcon from "@/public/assets/images/companies/sidebar/alert-triangle.svg";
import DotYellow from "@/public/assets/images/companies/sidebar/dot-yellow.svg";
import DotPink from "@/public/assets/images/companies/sidebar/dot-pink.svg";
import DotPurple from "@/public/assets/images/companies/sidebar/dot-purple.svg";
import UserPlusIcon from "@/public/assets/images/companies/sidebar/user-plus.svg";
import MessageQuestionIcon from "@/public/assets/images/companies/sidebar/message-question.svg";
import WalletIcon from "@/public/assets/images/companies/sidebar/wallet.svg";

const TEAM_ICONS = [TargetIcon, TargetAltIcon, UsersIcon] as const;
const PIPELINE_ICONS = [DotYellow, DotPink, DotPurple] as const;

export default function SidebarContent() {
  const pathname = usePathname();
  const { organization } = useWorkspace();
  const layout = useQuery(getWorkspaceSettings, { organizationId: organization._id });
  const salesVisible = layout?.enabledModules.includes("sales") ?? false;
  const lifecycleVisible = layout?.enabledModules.includes("lifecycle") ?? false;
  const { companies } = useCompanies();
  const { contacts } = useContacts();
  const { deals } = useDeals();
  const teams = useQuery(listTeams, { organizationId: organization._id }) ?? [];
  const pipelines =
    useQuery(listPipelines, { organizationId: organization._id }) ?? [];

  const openDeals = deals.filter(
    (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center gap-2 border-b p-3">
        <Logo aria-hidden className="size-8 shrink-0 overflow-visible" />
        <div className="min-w-0 flex-1">
          <span className="caption-style text-subtle block">Pama CRM</span>
          <OrganizationSwitcher />
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!layout ? (
          <p role="status" className="p-4 text-sm text-subtle">Loading workspace layout…</p>
        ) : (
        <nav aria-label="Primary">
          <SidebarSection className="border-sidebar-border border-b">
            {salesVisible && (
              <>
                <SidebarNavItem icon={BuildingIcon} label="Companies" href="/companies"
                  count={companies.length} active={pathname === "/companies"} />
                <SidebarNavItem icon={ClipboardIcon} label="Deals Board" href="/deals"
                  count={openDeals} active={pathname === "/deals"} />
                <SidebarNavItem icon={BarChartIcon} label="Forecast" href="/forecast"
                  active={pathname === "/forecast"} />
              </>
            )}
            <SidebarNavItem icon={BookClosedIcon}
              label={WORKSPACE_PRESETS[layout.preset].contactLabel} href="/contacts"
              count={contacts.length} active={pathname === "/contacts"} />
            <SidebarNavItem icon={ListIcon} label="Activities" href="/activities"
              active={pathname === "/activities"} />
            {lifecycleVisible && <SidebarNavItem icon={ListIcon} label="Events" href="/events"
              active={pathname === "/events"} />}
            {salesVisible && (
              <SidebarNavItem icon={MailIcon} label="Email Sequences"
                href="/sequences" active={pathname === "/sequences"} />
            )}
          </SidebarSection>

          <SidebarSection
            title="Team"
            className="border-sidebar-border border-b"
          >
            {teams.length > 0 ? (
              teams.slice(0, 6).map((team, index) => (
                <SidebarNavItem
                  key={team._id}
                  icon={TEAM_ICONS[index % TEAM_ICONS.length]}
                  label={team.name}
                  count={team.memberCount}
                  href={`/team?team=${team._id}`}
                  active={pathname === "/team"}
                />
              ))
            ) : (
              <SidebarNavItem
                icon={UsersIcon}
                label="Team"
                href="/team"
                active={pathname === "/team"}
              />
            )}
          </SidebarSection>

          {salesVisible && <SidebarSection
            title="Reporting"
            className="border-sidebar-border border-b"
          >
            <SidebarNavItem
              icon={BarChartAltIcon}
              label="Quarter Forecast"
              href="/reports/quarter"
              active={pathname === "/reports/quarter"}
            />
            <SidebarNavItem
              icon={AlertTriangleIcon}
              label="Slipping Deals"
              href="/reports/slipping"
              active={pathname === "/reports/slipping"}
            />
          </SidebarSection>}

          {salesVisible && <SidebarSection title="Pipelines">
            {pipelines.map((pipeline, index) => (
              <SidebarNavItem
                key={pipeline._id}
                icon={PIPELINE_ICONS[index % PIPELINE_ICONS.length]}
                label={pipeline.name}
                count={pipeline.dealCount}
                href={`/deals?pipeline=${pipeline._id}`}
                active={pathname === "/deals"}
              />
            ))}
            <SidebarNavItem
              icon={ClipboardIcon}
              label="Manage pipelines"
              href="/pipelines"
              tone="quiet"
              active={pathname === "/pipelines"}
            />
          </SidebarSection>}
        </nav>
        )}
      </ScrollArea>

      <SidebarSection className="border-sidebar-border shrink-0 border-t border-b">
        <SidebarNavItem
          icon={UserPlusIcon}
          label="Invite teammates"
          href="/team?invite=1"
          tone="quiet"
        />
        <SidebarNavItem
          icon={MessageQuestionIcon}
          label="Help"
          href="/help"
          tone="quiet"
          active={pathname === "/help"}
        />
      </SidebarSection>

      <div className="border-sidebar-border bg-sidebar-accent flex shrink-0 items-center justify-between gap-2 border-b p-4">
        <div className="min-w-0">
          <span className="lead-style block truncate font-medium tracking-[-0.01em]">
            {organization.planName}
          </span>
          <span className="caption-style text-subtle block capitalize">
            {organization.status} workspace
          </span>
        </div>
        <Button variant="muted" size="md" href="/settings">
          <WalletIcon aria-hidden className="size-3.5" />
          Settings
        </Button>
      </div>
    </div>
  );
}
