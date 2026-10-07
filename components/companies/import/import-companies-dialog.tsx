"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import Field from "@/components/_ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { SEGMENTS, STAGES, type Tag } from "@/data/companies";
import { TODAY } from "@/lib/companies";
import { findHeader, parseCsv, type CsvTable } from "@/lib/csv-import";
import { importCompanies } from "@/lib/convex/companies";
import { listOrganizationMembers } from "@/lib/convex/organizations";
import { useWorkspace } from "@/components/crm/workspace-provider";

type Mapping = {
  name: string;
  segment: string;
  relationship: string;
  owner: string;
  interactionDate: string;
  interactionType: string;
};

const EMPTY_MAPPING: Mapping = {
  name: "none",
  segment: "none",
  relationship: "none",
  owner: "none",
  interactionDate: "none",
  interactionType: "none",
};

export default function ImportCompaniesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { organization } = useWorkspace();
  const members =
    useQuery(listOrganizationMembers, { organizationId: organization._id }) ?? [];
  const importRows = useMutation(importCompanies);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => table?.rows.slice(0, 8) ?? [], [table]);

  async function loadFile(file: File) {
    const parsed = parseCsv(await file.text());
    setFileName(file.name);
    setTable(parsed);
    setMapping({
      name: findHeader(parsed.headers, ["company", "company name", "name"]),
      segment: findHeader(parsed.headers, ["segment"]),
      relationship: findHeader(parsed.headers, ["stage", "relationship"]),
      owner: findHeader(parsed.headers, ["owner", "account owner", "owner email"]),
      interactionDate: findHeader(parsed.headers, ["last interaction date", "interaction date"]),
      interactionType: findHeader(parsed.headers, ["last interaction", "interaction", "interaction type"]),
    });
    setResult(null);
  }

  function get(row: string[], key: keyof Mapping) {
    const value = mapping[key];
    return value === "none" ? "" : row[Number(value)] ?? "";
  }

  async function submit() {
    if (!table || mapping.name === "none") return;
    setSaving(true);
    setResult(null);

    const rows = table.rows.slice(0, 500).map((row) => {
      const tags: Tag[] = [];
      const segment = get(row, "segment");
      const relationship = get(row, "relationship");
      if ((SEGMENTS as readonly string[]).includes(segment)) {
        tags.push(segment as Tag);
      }
      if ((STAGES as readonly string[]).includes(relationship)) {
        tags.push(relationship as Tag);
      }

      const ownerValue = get(row, "owner").toLocaleLowerCase();
      const member = members.find(
        (item) =>
          item.email?.toLocaleLowerCase() === ownerValue ||
          item.name?.toLocaleLowerCase() === ownerValue,
      );

      return {
        name: get(row, "name"),
        tags,
        ownerSubject: member?.userSubject,
        lastInteraction: {
          date: get(row, "interactionDate") || TODAY,
          label: get(row, "interactionType") || "Imported",
        },
      };
    });

    try {
      const response = await importRows({
        organizationId: organization._id,
        rows,
      });
      setResult(
        `${response.created} imported · ${response.skipped} skipped`,
      );
      if (response.created > 0 && response.skipped === 0) {
        setTimeout(() => onOpenChange(false), 700);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import companies</DialogTitle>
          <DialogDescription>
            Upload up to 500 companies at once, map the CSV columns, preview the
            result, then import into {organization.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-6">
          <Field label="CSV file" htmlFor="company-import-file">
            <input
              id="company-import-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadFile(file);
              }}
              className="text-sm"
            />
          </Field>

          {table && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  ["name", "Company name"],
                  ["segment", "Segment"],
                  ["relationship", "Relationship"],
                  ["owner", "Account owner"],
                  ["interactionDate", "Interaction date"],
                  ["interactionType", "Interaction type"],
                ] as const).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Select
                      value={mapping[key]}
                      onValueChange={(value) =>
                        setMapping((current) => ({ ...current, [key]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not mapped</SelectItem>
                        {table.headers.map((header, index) => (
                          <SelectItem key={`${header}-${index}`} value={String(index)}>
                            {header || `Column ${index + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ))}
              </div>

              <div className="border-line-strong overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="bg-secondary">
                    <tr>
                      {table.headers.map((header, index) => (
                        <th key={`${header}-${index}`} className="px-3 py-2 font-medium">
                          {header || `Column ${index + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-border border-t">
                        {table.headers.map((_, columnIndex) => (
                          <td key={columnIndex} className="max-w-[220px] truncate px-3 py-2">
                            {row[columnIndex] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="caption-style text-subtle">
                {fileName} · {table.rows.length} rows detected
              </p>
            </>
          )}

          {result && <p className="caption-style text-soft">{result}</p>}
        </div>

        <DialogFooter>
          <Button variant="subtle" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!table || mapping.name === "none" || saving}
            onClick={submit}
          >
            {saving ? "Importing…" : "Import companies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
