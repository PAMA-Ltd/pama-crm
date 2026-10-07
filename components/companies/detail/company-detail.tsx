"use client";

import Asset from "@/components/_ui/asset";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import { ScrollArea } from "@/components/_ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/_ui/sheet";
import DetailSection from "./detail-section";
import PipelineHealth from "./pipeline-health";
import { TAG_TONES } from "@/data/companies";
import { useCompaniesStore } from "@/stores/companies-store";
import { useCompanies } from "@/hooks/use-companies";
import BuildingIcon from "@/public/assets/images/companies/detail/building.svg";
import XIcon from "@/public/assets/images/companies/detail/x.svg";

export default function CompanyDetail() {
  const detailId = useCompaniesStore((state) => state.detailId);
  const detailOpen = useCompaniesStore((state) => state.detailOpen);
  const { companies } = useCompanies();
  const closeDetail = useCompaniesStore((state) => state.closeDetail);

  const company = companies.find((item) => item.id === detailId);

  return (
    <Sheet
      open={detailOpen && company !== undefined}
      onOpenChange={(open) => !open && closeDetail()}
    >
      <SheetContent side="right" className="sm:w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <BuildingIcon aria-hidden className="text-icon size-3.5" />
            <SheetTitle>Company detail</SheetTitle>
          </div>
          <SheetDescription className="sr-only">
            Company summary and live pipeline health
          </SheetDescription>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1"
              aria-label="Close details"
            >
              <XIcon aria-hidden className="text-foreground size-4" />
            </Button>
          </SheetClose>
        </SheetHeader>

        {company && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex items-start gap-3 p-5 shadow-[inset_0_-1px_0_var(--line-strong)]">
              <span className="bg-muted flex size-[50px] shrink-0 items-center justify-center rounded-[12.5px] shadow-[0px_6.25px_6.25px_0px_rgba(15,15,15,0.24),0px_0px_0px_1.563px_#232323]">
                {company.logo ? (
                  <Asset
                    type="image"
                    src={company.logo}
                    alt={`${company.name} logo`}
                    width={1}
                    height={1}
                    fit="contain"
                    className="size-8"
                  />
                ) : (
                  <span className="h2-style text-soft">
                    {company.name.slice(0, 1)}
                  </span>
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <h2 className="truncate">{company.name}</h2>
                <div className="flex flex-wrap items-center gap-[3px]">
                  {company.tags.map((tag) => (
                    <Tag key={tag} tone={TAG_TONES[tag]} size="sm">
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>

            <DetailSection title="Account owner">
              <p className="lead-style">{company.owner}</p>
            </DetailSection>

            <DetailSection title="Pipeline health" className="shadow-none">
              <PipelineHealth company={company} />
            </DetailSection>
          </ScrollArea>
        )}

        <SheetFooter>
          <Button variant="secondary" size="sm" href="/contacts">
            View contacts
          </Button>
          <Button variant="primary" size="sm" href="/deals">
            View deals
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
