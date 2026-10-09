"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Button from "@/components/_ui/button";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
} from "@/lib/convex/workspace-settings";
import {
  modulesForPreset,
  WORKSPACE_MODULE_IDS,
  WORKSPACE_MODULES,
  WORKSPACE_PRESET_IDS,
  WORKSPACE_PRESETS,
  type WorkspaceModule,
  type WorkspacePreset,
} from "@/lib/workspaces/presets";

export default function WorkspaceLayoutSettings({
  organizationId,
  role,
}: {
  organizationId: string;
  role: "owner" | "admin" | "member";
}) {
  const config = useQuery(getWorkspaceSettings, { organizationId });
  const saveSettings = useMutation(updateWorkspaceSettings);
  const [draft, setDraft] = useState<{ preset: WorkspacePreset; modules: WorkspaceModule[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canEdit = role !== "member";
  const preset = draft?.preset ?? config?.preset ?? "sales";
  const modules = draft?.modules ?? config?.enabledModules ?? modulesForPreset("sales");

  function choosePreset(value: WorkspacePreset) {
    setDraft({ preset: value, modules: modulesForPreset(value) });
    setNotice(null);
  }

  function toggleModule(module: WorkspaceModule) {
    setDraft({
      preset,
      modules: modules.includes(module)
        ? modules.filter((id) => id !== module)
        : [...modules, module],
    });
    setNotice(null);
  }

  async function save() {
    if (!config || !canEdit || saving) return;
    if (preset !== config.preset) {
      const okay = window.confirm(
        "Apply a different workspace layout? This changes navigation and labels only. All records, permissions and integrations will be preserved.",
      );
      if (!okay) return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await saveSettings({
        organizationId,
        preset,
        enabledModules: modules,
        expectedVersion: config.configVersion,
      });
      setDraft(null);
      setNotice("Workspace layout saved for everyone in this organization.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save workspace settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <section className="border-line-strong bg-card rounded-xl border p-4">
        <h2>Workspace layout</h2>
        <p className="caption-style text-subtle mt-2">Loading workspace preferences…</p>
      </section>
    );
  }

  return (
    <section className="border-line-strong bg-card rounded-xl border p-4">
      <h2>Workspace layout</h2>
      <p className="text-soft mt-2 leading-5">
        Choose a starting layout, then adjust modules independently. This is not a permanent
        business classification. Changing the layout never deletes your records.
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="workspace-preset" className="mb-2 block text-sm font-medium">
            Workspace preset
          </label>
          <select
            id="workspace-preset"
            className="border-line-strong bg-background text-foreground w-full rounded-lg border px-3 py-2"
            value={preset}
            disabled={!canEdit || saving}
            onChange={(event) => choosePreset(event.target.value as WorkspacePreset)}
          >
            {WORKSPACE_PRESET_IDS.map((id) => (
              <option key={id} value={id}>{WORKSPACE_PRESETS[id].label}</option>
            ))}
          </select>
          <p className="caption-style text-subtle mt-2">{WORKSPACE_PRESETS[preset].description}</p>
        </div>
        <fieldset disabled={!canEdit || saving}>
          <legend className="mb-2 text-sm font-medium">Enabled modules</legend>
          <div className="space-y-2">
            {WORKSPACE_MODULE_IDS.map((id) => (
              <label key={id} className="border-line-strong flex items-start gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  checked={modules.includes(id)}
                  onChange={() => toggleModule(id)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">
                    {WORKSPACE_MODULES[id].label}
                    {!WORKSPACE_MODULES[id].ready && (
                      <span className="caption-style text-subtle ml-2">(upcoming)</span>
                    )}
                  </span>
                  <span className="caption-style text-subtle mt-1 block">
                    {WORKSPACE_MODULES[id].description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="bg-background rounded-lg p-3">
          <p className="font-medium">Layout preview</p>
          <p className="caption-style text-subtle mt-1">
            People appear as “{WORKSPACE_PRESETS[preset].contactLabel}”. Activities and Team stay visible.
            {modules.includes("sales")
              ? " Companies, Deals, Pipelines, Forecast and Sales reporting are also shown."
              : " Sales navigation is hidden, but existing sales records are kept."}
          </p>
          <p className="caption-style text-subtle mt-2">
            Lifecycle, Campaigns and Automations can be configured now, but their new screens and
            event processing are not yet released. This setting is a presentation preference,
            not an authorization boundary or email-sending switch.
          </p>
        </div>
        {error && <p role="alert" className="caption-style text-danger">{error}</p>}
        {notice && <p role="status" className="caption-style text-soft">{notice}</p>}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save workspace layout"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => choosePreset(preset)}
            >
              Reset modules to preset
            </Button>
          </div>
        ) : (
          <p className="caption-style text-subtle">Only organization owners and admins can change this layout.</p>
        )}
      </div>
    </section>
  );
}
