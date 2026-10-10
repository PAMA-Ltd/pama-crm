"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import PageHeader from "@/components/crm/page-header";
import { useWorkspace } from "@/components/crm/workspace-provider";
import { getWorkspaceSettings } from "@/lib/convex/workspace-settings";
import {
  archiveCampaign, createAutomation, createCampaign, createSegment,
  listAutomationRuns, listAutomations, listCampaigns, listSegments,
  previewCampaign, previewSegment, setAutomationStatus, updateCampaign, updateSegment,
} from "@/lib/convex/engagement";

type Mode = "segments" | "campaigns" | "automations";
const inputClass = "border-line-strong bg-background mt-1 w-full rounded-lg border px-3 py-2";
const buttonClass = "rounded-lg border border-line-strong px-3 py-2 text-sm font-medium disabled:opacity-50";

export default function EngagementPage({ mode }: { mode: Mode }) {
  const { organization } = useWorkspace();
  const organizationId = organization._id;
  const layout = useQuery(getWorkspaceSettings, { organizationId });
  const lifecycleOn = layout?.enabledModules.includes("lifecycle") ?? false;
  const canEdit = organization.role !== "member";
  const segments = useQuery(listSegments, mode !== "automations" ? { organizationId } : "skip");
  const campaigns = useQuery(listCampaigns, mode === "campaigns" ? { organizationId } : "skip");
  const automations = useQuery(listAutomations, mode === "automations" ? { organizationId } : "skip");
  const runs = useQuery(listAutomationRuns, mode === "automations" ? { organizationId } : "skip");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const audience = useQuery(previewSegment, mode === "segments" && selectedSegment
    ? { organizationId, segmentId: selectedSegment } : "skip");
  const campaignAudience = useQuery(previewCampaign, mode === "campaigns" && selectedCampaign
    ? { organizationId, campaignId: selectedCampaign } : "skip");

  const createSegmentMutation = useMutation(createSegment);
  const updateSegmentMutation = useMutation(updateSegment);
  const createCampaignMutation = useMutation(createCampaign);
  const updateCampaignMutation = useMutation(updateCampaign);
  const archiveCampaignMutation = useMutation(archiveCampaign);
  const createAutomationMutation = useMutation(createAutomation);
  const setStatusMutation = useMutation(setAutomationStatus);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [eventType, setEventType] = useState("");
  const [tag, setTag] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function clearForm() {
    setName(""); setSource(""); setEventType(""); setTag("");
    setSegmentId(""); setSubject(""); setBody(""); setEditingId(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (mode === "segments") {
        const args = { organizationId, name: name.trim(),
          source: source.trim() || undefined, lastEventType: eventType.trim() || undefined,
          requiredTag: tag.trim() || undefined };
        if (editingId) await updateSegmentMutation({ ...args, segmentId: editingId });
        else await createSegmentMutation(args);
        setNotice(editingId ? "Segment updated." : "Segment created.");
      } else if (mode === "campaigns") {
        if (!segmentId) throw new Error("Choose an audience segment first.");
        const args = { organizationId, name: name.trim(), segmentId,
          subject: subject.trim(), body: body.trim() };
        if (editingId) await updateCampaignMutation({ ...args, campaignId: editingId });
        else await createCampaignMutation(args);
        setNotice(editingId ? "Campaign draft updated." : "Campaign draft saved. No email was sent.");
      } else {
        await createAutomationMutation({ organizationId, name: name.trim(),
          eventType: eventType.trim(), source: source.trim() || undefined, tag: tag.trim() });
        setNotice("Automation saved as a draft. Activate it after reviewing the trigger.");
      }
      clearForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally { setSaving(false); }
  }
  async function changeAutomation(id: string, status: "active" | "paused") {
    setError(""); setNotice("");
    if (status === "active" && !lifecycleOn) {
      setError("Enable Lifecycle in Workspace Settings before activating automations.");
      return;
    }
    if (status === "active" && !window.confirm(
      "Activate this automation? New matching events will update profile tags automatically."
    )) return;
    try {
      await setStatusMutation({ organizationId, automationId: id, status });
      setNotice(status === "active" ? "Automation activated." : "Automation paused.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to change automation."); }
  }
  async function archive(id: string) {
    if (!window.confirm("Archive this campaign draft? It cannot be edited afterward.")) return;
    setError(""); setNotice("");
    try { await archiveCampaignMutation({ organizationId, campaignId: id }); setNotice("Campaign archived."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Archive failed."); }
  }
  function editSegment(row: NonNullable<typeof segments>[number]) {
    setEditingId(row._id); setName(row.name); setSource(row.source ?? "");
    setEventType(row.lastEventType ?? ""); setTag(row.requiredTag ?? "");
    setError(""); setNotice("");
  }
  function editCampaign(row: NonNullable<typeof campaigns>[number]) {
    setEditingId(row._id); setName(row.name); setSegmentId(row.segmentId);
    setSubject(row.subject); setBody(row.body); setError(""); setNotice("");
  }
  const heading = mode === "segments" ? "Audience Segments" :
    mode === "campaigns" ? "Campaign Drafts" : "Automations";
  const itemClass = "border-line-strong rounded-xl border p-4";
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col">
    <PageHeader title={heading} description={organization.name} />
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-4xl space-y-4">
        <section className={itemClass}>
          <h2 className="font-medium">{mode === "segments" ? "Dynamic audience" :
            mode === "campaigns" ? "No outbound sending" : "Event-triggered profile tagging"}</h2>
          <p className="caption-style text-subtle mt-2">
            {mode === "segments"
              ? "Rules match event profiles from this workspace. Preview is capped at 500 profiles; partial counts are clearly marked."
              : mode === "campaigns"
                ? "Prepare consent-aware email content and preview eligibility. Sending is disabled until consent and delivery verification are complete."
                : "Active rules add a tag on new matching events. No messages are sent or workflows run outside this workspace."}
          </p>
          {mode === "automations" && !lifecycleOn && <p role="alert" className="mt-2 text-sm">
            Lifecycle ingestion is disabled. Automations cannot run until enabled in Workspace Settings.
            Existing active rules are suspended, and new rules cannot be activated.
          </p>}
        </section>
        {canEdit && <section className={itemClass}>
          <h2 className="font-medium">{editingId ? "Edit" : "Create"} {mode === "segments" ? "segment"
            : mode === "campaigns" ? "campaign draft" : "automation rule"}</h2>
          <form onSubmit={e => void submit(e)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Name
              <input className={inputClass} required maxLength={100} value={name}
                onChange={e => setName(e.target.value)} />
            </label>
            {mode !== "campaigns" && <label className="text-sm">Source (optional)
              <input className={inputClass} placeholder="pamastore" maxLength={64} value={source}
                onChange={e => setSource(e.target.value.toLowerCase())} />
            </label>}
            {mode !== "campaigns" && <label className="text-sm">{mode === "automations"
              ? "Trigger event type" : "Last event type (optional)"}
              <input className={inputClass} placeholder="order_paid" required={mode === "automations"}
                maxLength={96} value={eventType} onChange={e => setEventType(e.target.value.toLowerCase())} />
            </label>}
            {mode !== "campaigns" && <label className="text-sm">{mode === "segments"
              ? "Required profile tag (optional)" : "Tag to add"}
              <input className={inputClass} placeholder="customer" required={mode === "automations"}
                maxLength={32} value={tag} onChange={e => setTag(e.target.value.toLowerCase())} />
            </label>}
            {mode === "campaigns" && <>
              <label className="text-sm">Audience segment
                <select className={inputClass} required value={segmentId} onChange={e => setSegmentId(e.target.value)}>
                  <option value="">Choose segment</option>
                  {segments?.map(row => <option key={row._id} value={row._id}>{row.name}</option>)}
                </select>
              </label>
              <label className="text-sm">Email subject
                <input className={inputClass} required maxLength={180} value={subject}
                  onChange={e => setSubject(e.target.value)} />
              </label>
              <label className="text-sm sm:col-span-2">Email body (draft only)
                <textarea className={inputClass} required maxLength={12000} rows={5} value={body}
                  onChange={e => setBody(e.target.value)} />
              </label>
            </>}
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <button type="submit" className={buttonClass} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Create"}
              </button>
              {editingId && <button type="button" className={buttonClass} onClick={clearForm}>Cancel editing</button>}
            </div>
          </form>
        </section>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        {notice && <p role="status" className="text-soft">{notice}</p>}
        <section className={itemClass}>
          <h2 className="font-medium">Saved {mode}</h2>
          <div className="mt-3 space-y-3">
            {mode === "segments" && (segments?.length ? segments.map(row =>
              <article key={row._id} className={itemClass}>
                <h3 className="font-medium">{row.name}</h3>
                <p className="caption-style text-subtle mt-1">
                  {row.source || "Any source"} · Last event: {row.lastEventType || "Any"} · Tag: {row.requiredTag || "Any"}
                </p>
                <div className="mt-2 flex gap-2">
                  <button className={buttonClass} onClick={() => setSelectedSegment(row._id)}>Preview audience</button>
                  {canEdit && <button className={buttonClass} onClick={() => editSegment(row)}>Edit</button>}
                </div>
                {selectedSegment === row._id && <p role="status" className="mt-2 text-sm">
                  {audience ? `${audience.matched} matched · ${audience.marketingEligible} opted-in with email · ${audience.suppressed} suppressed${audience.partial ? " · PARTIAL RESULTS (first 500 profiles)" : ""}` : "Calculating…"}
                </p>}
              </article>) : <p className="text-subtle">No segments yet.</p>)}
            {mode === "campaigns" && (campaigns?.length ? campaigns.map(row =>
              <article key={row._id} className={itemClass}>
                <h3 className="font-medium">{row.name} · {row.status}</h3>
                <p className="caption-style text-subtle mt-1">Subject: {row.subject}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={buttonClass} onClick={() => setSelectedCampaign(row._id)}>Preview eligibility</button>
                  {canEdit && row.status === "draft" && <>
                    <button className={buttonClass} onClick={() => editCampaign(row)}>Edit</button>
                    <button className={buttonClass} onClick={() => void archive(row._id)}>Archive</button>
                  </>}
                </div>
                {selectedCampaign === row._id && <p role="status" className="mt-2 text-sm">
                  {campaignAudience ? `${campaignAudience.marketingEligible} eligible · ${campaignAudience.suppressed} suppressed${campaignAudience.partial ? " · PARTIAL RESULTS" : ""} · Sending disabled` : "Calculating…"}
                </p>}
              </article>) : <p className="text-subtle">No campaigns yet. Create a segment first.</p>)}
            {mode === "automations" && (automations?.length ? automations.map(row =>
              <article key={row._id} className={itemClass}>
                <h3 className="font-medium">{row.name} · {row.status === "active" && !lifecycleOn ? "suspended (Lifecycle disabled)" : row.status}</h3>
                <p className="caption-style text-subtle mt-1">
                  When {row.source || "any source"} emits {row.eventType}, add tag “{row.tag}”
                </p>
                {canEdit && <button disabled={row.status !== "active" && !lifecycleOn}
                  title={row.status !== "active" && !lifecycleOn ? "Enable Lifecycle ingestion first" : undefined}
                  className={buttonClass + " mt-2"} onClick={() => void changeAutomation(
                  row._id, row.status === "active" ? "paused" : "active"
                )}>{row.status === "active" ? "Pause" : "Activate"}</button>}
              </article>) : <p className="text-subtle">No automation rules yet.</p>)}
          </div>
        </section>
        {mode === "automations" && <section className={itemClass}>
          <h2 className="font-medium">Recent automation runs</h2>
          {runs?.length ? <div className="mt-2 space-y-2">{runs.map(run =>
            <p key={run._id} className="caption-style text-subtle">
              {run.outcome} · Event {run.eventId} · {new Date(run.createdAt).toLocaleString()}
            </p>)}</div> : <p className="caption-style text-subtle mt-2">No executions yet.</p>}
        </section>}
      </div>
    </div>
  </section>;
}
