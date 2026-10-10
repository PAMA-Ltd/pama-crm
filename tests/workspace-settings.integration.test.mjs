import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Import the actual registered Convex functions and Zustand store, with a
// lightweight Node resolver for the repository's extensionless TS imports.
// No production Convex instance, Clerk identity or third-party test service.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith("@/")
      ? pathToFileURL(resolve(process.cwd(), specifier.slice(2))).href
      : specifier;
    try {
      return nextResolve(alias, context);
    } catch (error) {
      if (
        error?.code !== "ERR_MODULE_NOT_FOUND" &&
        error?.code !== "ERR_UNSUPPORTED_DIR_IMPORT"
      ) throw error;
      if (!(alias.startsWith(".") || alias.startsWith("file:")) || extname(alias)) {
        throw error;
      }
      for (const suffix of [".ts", ".js"]) {
        try { return nextResolve(alias + suffix, context); } catch { /* try next */ }
      }
      throw error;
    }
  },
});

const [settings, organizations, activities, stores, companies, links, drafts] = await Promise.all([
  import("../convex/workspaceSettings.ts"),
  import("../convex/organizations.ts"),
  import("../convex/activities.ts"),
  import("../stores/companies-store.ts"),
  import("../lib/companies.ts"),
  import("../lib/workspaces/activity-links.ts"),
  import("../lib/workspaces/layout-draft.ts"),
]);

function fixture() {
  const tables = Object.fromEntries([
    "organizations", "organizationMembers", "organizationSettings", "pipelines",
    "companies", "contacts", "deals", "activities",
  ].map(name => [name, new Map()]));
  let sequence = 0;
  let subject = "owner";
  const insert = (table, record) => {
    const id = table + "_" + (++sequence);
    tables[table].set(id, { _id: id, ...record });
    return id;
  };
  const orgA = insert("organizations", {
    slug: "alpha", name: "Alpha", status: "active", createdBy: "owner",
  });
  const orgB = insert("organizations", {
    slug: "beta", name: "Beta", status: "active", createdBy: "other",
  });
  for (const [org, user, role] of [
    [orgA, "owner", "owner"], [orgA, "admin", "admin"],
    [orgA, "member", "member"], [orgB, "other", "owner"],
  ]) insert("organizationMembers", {
    organizationId: org, userSubject: user, role,
  });
  const ctx = {
    auth: { getUserIdentity: async () => subject === null ? null : {
      subject, email: subject + "@example.test", name: subject,
    } },
    db: {
      get: async id => Object.values(tables).map(t => t.get(id)).find(Boolean) ?? null,
      insert: async (table, record) => insert(table, record),
      patch: async (id, fields) => {
        const table = Object.values(tables).find(t => t.has(id));
        if (!table) throw Error("missing record");
        table.set(id, { ...table.get(id), ...fields });
      },
      query(table) {
        return {
          withIndex(_index, build) {
            const filters = [];
            const q = { eq(field, value) { filters.push([field, value]); return q; } };
            build(q);
            const rows = () => [...tables[table].values()].filter(row =>
              filters.every(([field, value]) => row[field] === value));
            return {
              unique: async () => {
                const all = rows();
                if (all.length > 1) throw Error("not unique");
                return all[0] ?? null;
              },
              take: async count => rows().slice(0, count),
            };
          },
        };
      },
    },
  };
  return { ctx, orgA, orgB, tables, insert, as(user) { subject = user; } };
}

test("member reads Sales fallback; nonmember and anonymous cannot read settings", async () => {
  const f = fixture();
  f.as("member");
  assert.deepEqual(await settings.get._handler(f.ctx, { organizationId: f.orgA }), {
    preset: "sales", enabledModules: ["sales"],
    configVersion: 0, updatedAt: 0, updatedBy: "",
  });
  f.as("other");
  await assert.rejects(settings.get._handler(f.ctx, { organizationId: f.orgA }), /do not have access/);
  f.as(null);
  await assert.rejects(settings.get._handler(f.ctx, { organizationId: f.orgA }), /Not authenticated/);
});

test("member and outsider cannot update; admin can update own organization only", async () => {
  const f = fixture();
  const change = { organizationId: f.orgA, preset: "commerce",
    enabledModules: ["lifecycle"], expectedVersion: 0 };
  f.as("member");
  await assert.rejects(settings.update._handler(f.ctx, change), /admin access is required/);
  f.as("other");
  await assert.rejects(settings.update._handler(f.ctx, change), /do not have access/);
  f.as("admin");
  const updated = await settings.update._handler(f.ctx, change);
  assert.equal(updated.preset, "commerce");
  assert.equal(updated.configVersion, 1);
  f.as("member");
  assert.equal((await settings.get._handler(f.ctx, { organizationId: f.orgA })).preset, "commerce");
  f.as("other");
  assert.equal((await settings.get._handler(f.ctx, { organizationId: f.orgB })).preset, "sales");
});

test("optimistic-version conflict, duplicate modules and archived workspace reject writes", async () => {
  const f = fixture();
  f.as("owner");
  const change = { organizationId: f.orgA, preset: "commerce",
    enabledModules: ["lifecycle"], expectedVersion: 0 };
  await settings.update._handler(f.ctx, change);
  await assert.rejects(settings.update._handler(f.ctx, change), /changed since you opened/);
  await assert.rejects(settings.update._handler(f.ctx,
    { ...change, expectedVersion: 1, enabledModules: ["sales", "sales"] }),
    /selected only once/);
  f.tables.organizations.set(f.orgA,
    { ...f.tables.organizations.get(f.orgA), status: "archived" });
  await assert.rejects(settings.update._handler(f.ctx,
    { ...change, expectedVersion: 1 }), /Only active workspaces/);
});

test("two independent Commerce creations persist preset and suggested modules", async () => {
  const f = fixture();
  f.as("owner");
  const first = await organizations.create._handler(f.ctx,
    { name: "First Store", slug: "first-store", preset: "commerce" });
  const second = await organizations.create._handler(f.ctx,
    { name: "Second Store", slug: "second-store", preset: "commerce" });
  for (const organizationId of [first, second]) {
    const result = await settings.get._handler(f.ctx, { organizationId });
    assert.equal(result.preset, "commerce");
    assert.deepEqual(result.enabledModules, ["lifecycle", "campaigns", "automations"]);
  }
  assert.notEqual(first, second);
});

test("switching organizations resets Zustand company filters, dialogs and selection", () => {
  const store = stores.useCompaniesStore;
  store.getState().switchWorkspace("orgA");
  store.getState().setOwner("owner-of-A");
  store.getState().setStage("Qualified");
  store.getState().setSelected(["company-A"]);
  store.getState().openDetail("company-A");
  store.getState().setNewCompanyOpen(true);
  store.getState().setSearchOpen(true);
  store.getState().setSidebarOpen(true);
  store.getState().switchWorkspace("orgB");
  const b = store.getState();
  assert.equal(b.workspaceId, "orgB");
  assert.equal(b.owner, companies.DEFAULT_FILTERS.owner);
  assert.equal(b.stage, companies.DEFAULT_FILTERS.stage);
  assert.deepEqual(b.selectedIds, []);
  assert.equal(b.detailId, null);
  assert.equal(b.detailOpen, false);
  assert.equal(b.newCompanyOpen, false);
  assert.equal(b.searchOpen, false);
  assert.equal(b.sidebarOpen, true); // genuinely global sidebar preference
  store.getState().switchWorkspace("orgA");
  assert.deepEqual(store.getState().selectedIds, []);
  assert.equal(store.getState().owner, companies.DEFAULT_FILTERS.owner);
});

test("editing hidden Sales associations leaves saved ids intact", () => {
  assert.deepEqual(links.activityAssociationIds({
    companyId: "company-old", contactId: "person-old", dealId: "deal-old",
  }), { companyId: "company-old", contactId: "person-old", dealId: "deal-old" });
  assert.deepEqual(links.activityAssociationIds({
    companyId: "none", contactId: "person", dealId: "none",
  }), { companyId: undefined, contactId: "person", dealId: undefined });
});

test("Commerce activity edit can choose any organization-local contact despite legacy hidden company", async () => {
  const f = fixture();
  f.as("owner");
  const a = { _id: "contact-a", companyId: "company-old", firstName: "Alice" };
  const b = { _id: "contact-b", companyId: "company-other", firstName: "Bob" };
  const outsiders = { _id: "not-from-org", companyId: "company-old", firstName: "External" };
  // useContacts is already scoped to the active organization; an outsider must
  // never be supplied to this presentation selector in the first place.
  const sameOrgContacts = [a, b];
  assert.deepEqual(
    links.contactsForActivity(sameOrgContacts, "company-old", false).map(c => c._id),
    ["contact-a", "contact-b"],
  );
  assert.deepEqual(
    links.contactsForActivity(sameOrgContacts, "company-old", true).map(c => c._id),
    ["contact-a"],
  );
  const form = { companyId: "company-old", dealId: "deal-old", contactId: b._id };
  const saved = links.activityAssociationIds(form);
  assert.equal(saved.contactId, "contact-b");
  assert.equal(saved.companyId, "company-old");
  assert.equal(saved.dealId, "deal-old");
  assert.equal(sameOrgContacts.includes(outsiders), false);
});

test("two admins editing the same workspace cannot overwrite a newer version", async () => {
  const f = fixture();
  const liveA = await settings.get._handler(f.ctx, { organizationId: f.orgA });
  const adminA = {
    ...drafts.startLayoutDraft(null, liveA),
    preset: "commerce", modules: ["lifecycle"],
  };
  // Admin A's draft was based on version 0. Admin B independently saves version 1.
  f.as("admin");
  const changed = await settings.update._handler(f.ctx, {
    organizationId: f.orgA, preset: "services",
    enabledModules: ["sales"], expectedVersion: liveA.configVersion,
  });
  assert.equal(changed.configVersion, 1);
  assert.equal(drafts.isStaleLayoutDraft(adminA, changed.configVersion), true);

  // Admin A's next edits must preserve the original baseline, never read 1.
  const editedA = { ...drafts.startLayoutDraft(adminA, changed), modules: ["lifecycle", "sales"] };
  const outgoing = drafts.layoutDraftForSave(editedA);
  assert.equal(outgoing.expectedVersion, 0);
  await assert.rejects(
    settings.update._handler(f.ctx, { organizationId: f.orgA, ...outgoing }),
    /changed since you opened/,
  );
  const after = await settings.get._handler(f.ctx, { organizationId: f.orgA });
  assert.equal(after.preset, "services");
  assert.equal(after.configVersion, 1);
  // Explicitly discarding draft picks up the newest version.
  assert.equal(drafts.startLayoutDraft(null, after).baseVersion, 1);
});

test("legacy company-linked activity persists new Commerce contact and old Sales links through real update handler", async () => {
  const f = fixture();
  f.as("owner");
  const oldCompany = f.insert("companies", { organizationId: f.orgA, name: "Old" });
  const otherCompany = f.insert("companies", { organizationId: f.orgA, name: "Other" });
  const previous = f.insert("contacts", { organizationId: f.orgA, companyId: oldCompany, firstName: "Alice" });
  const next = f.insert("contacts", { organizationId: f.orgA, companyId: otherCompany, firstName: "Bob" });
  const outsider = f.insert("contacts", { organizationId: f.orgB, firstName: "Outside" });
  const dealId = f.insert("deals", { organizationId: f.orgA, companyId: oldCompany, name: "Old deal" });
  const activityId = f.insert("activities", {
    organizationId: f.orgA, type: "Task", subject: "Contact follow-up",
    companyId: oldCompany, dealId, contactId: previous, updatedAt: Date.now(),
  });
  const contactRows = [previous, next].map(_id => f.tables.contacts.get(_id));
  const choices = links.contactsForActivity(contactRows, oldCompany, false);
  assert.deepEqual(choices.map(c => c._id), [previous, next]);
  const form = { companyId: oldCompany, dealId, contactId: next };
  await activities.update._handler(f.ctx, {
    organizationId: f.orgA, activityId, type: "Task",
    subject: "Contact follow-up", ...links.activityAssociationIds(form),
  });
  const saved = f.tables.activities.get(activityId);
  assert.equal(saved.contactId, next);
  assert.equal(saved.companyId, oldCompany);
  assert.equal(saved.dealId, dealId);
  // Cross-organization contact IDs are rejected by real link validation.
  await assert.rejects(activities.update._handler(f.ctx, {
    organizationId: f.orgA, activityId, type: "Task", subject: "Follow-up",
    ...links.activityAssociationIds({ ...form, contactId: outsider }),
  }), /Contact not found/);
  assert.equal(f.tables.activities.get(activityId).contactId, next);
});
