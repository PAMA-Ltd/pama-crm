"use client";

import { useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import FormSection from "./form-section";
import LogoUpload from "./logo-upload";
import {
  INTERACTION_TYPES,
  SEGMENTS,
  STAGES,
  type Segment,
  type Stage,
} from "@/data/companies";
import { TODAY } from "@/lib/companies";
import { createCompany } from "@/lib/convex/companies";
import { listOrganizationMembers } from "@/lib/convex/organizations";
import { useCompaniesStore } from "@/stores/companies-store";
import { useWorkspace } from "@/components/crm/workspace-provider";
import PlusIcon from "@/public/assets/images/_common/plus.svg";

type FormState = {
  logo: string | null;
  name: string;
  segment: Segment;
  stage: Stage;
  ownerSubject: string;
  interactionDate: string;
  interactionType: string;
};

const EMPTY_FORM: FormState = {
  logo: null,
  name: "",
  segment: SEGMENTS[0],
  stage: STAGES[0],
  ownerSubject: "",
  interactionDate: TODAY,
  interactionType: INTERACTION_TYPES[0],
};

export default function NewCompanyDialog() {
  const { organization } = useWorkspace();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const open = useCompaniesStore((state) => state.newCompanyOpen);
  const setOpen = useCompaniesStore((state) => state.setNewCompanyOpen);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const create = useMutation(createCompany);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setNameError("Enter a company name.");
      nameRef.current?.focus();
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await create({
        organizationId: organization._id,
        name,
        logo: form.logo ?? undefined,
        tags: [form.segment, form.stage],
        ownerSubject: form.ownerSubject || undefined,
        lastInteraction: {
          date: form.interactionDate || TODAY,
          label: form.interactionType,
        },
      });
      setOpen(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create company.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-[560px]"
        onCloseAutoFocus={() => {
          setForm(EMPTY_FORM);
          setNameError(null);
          setSubmitError(null);
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col">
          <DialogHeader>
            <DialogTitle>New Company</DialogTitle>
            <DialogDescription>
              Add a company to {organization.name}. Deal totals and probability
              will be calculated from real opportunities.
            </DialogDescription>
          </DialogHeader>

          <FormSection title="Company">
            <LogoUpload
              value={form.logo}
              companyName={form.name}
              onChange={(logo) => update("logo", logo)}
            />
            <Field
              label="Company name"
              htmlFor="company-name"
              required
              error={nameError ?? undefined}
            >
              <Input
                ref={nameRef}
                id="company-name"
                value={form.name}
                onChange={(event) => {
                  update("name", event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Acme Inc."
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Segment" htmlFor="company-segment">
                <Select
                  value={form.segment}
                  onValueChange={(value) => update("segment", value as Segment)}
                >
                  <SelectTrigger id="company-segment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((segment) => (
                      <SelectItem key={segment} value={segment}>{segment}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Relationship" htmlFor="company-stage">
                <Select
                  value={form.stage}
                  onValueChange={(value) => update("stage", value as Stage)}
                >
                  <SelectTrigger id="company-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((stage) => (
                      <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection title="Ownership & activity">
            <Field label="Account owner" htmlFor="company-owner">
              <Select
                value={form.ownerSubject || "automatic"}
                onValueChange={(value) =>
                  update("ownerSubject", value === "automatic" ? "" : value)
                }
              >
                <SelectTrigger id="company-owner"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Me</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member._id} value={member.userSubject}>
                      {member.name || member.email || "CRM member"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" htmlFor="company-interaction-date">
                <Input
                  id="company-interaction-date"
                  type="date"
                  max={TODAY}
                  value={form.interactionDate}
                  onChange={(event) => update("interactionDate", event.target.value)}
                />
              </Field>
              <Field label="Type" htmlFor="company-interaction-type">
                <Select
                  value={form.interactionType}
                  onValueChange={(value) => update("interactionType", value)}
                >
                  <SelectTrigger id="company-interaction-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERACTION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          {submitError && (
            <p role="alert" className="caption-style text-danger px-5 pb-3">
              {submitError}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="subtle" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
              <PlusIcon aria-hidden className="size-3" />
              {isSubmitting ? "Creating…" : "Create Company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
