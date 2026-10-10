import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith("@/")
      ? pathToFileURL(resolve(process.cwd(), specifier.slice(2))).href : specifier;
    try { return nextResolve(alias, context); }
    catch (error) {
      if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(error?.code) ||
          !(alias.startsWith(".") || alias.startsWith("file:")) || extname(alias)) throw error;
      for (const suffix of [".ts", ".js"]) {
        try { return nextResolve(alias + suffix, context); } catch { /* next */ }
      }
      throw error;
    }
  },
});
const [{ normalizeLifecycleEvent }, lifecycle] = await Promise.all([
  import("../lib/lifecycle/event-contract.ts"),
  import("../convex/lifecycle.ts"),
]);

const SECRET = "test-bridge-secret-isolated-0123456789abcdef";
process.env.CRM_LIFECYCLE_BRIDGE_SECRET = SECRET;
process.env.CRM_LIFECYCLE_ENVIRONMENT = "staging";
const HASH = "a".repeat(64);
const NOW = Date.now();
const common = {
  bridgeSecret: SECRET, tokenHash: HASH, organizationSlug: "pamastore",
  source: "pamastore", environment: "staging", eventId: "event-1",
  type: "order_paid", subjectId: "buyer-9", occurredAt: NOW,
  email: "buyer@example.test", propertiesJson: '{"orderId":"order-1"}',
};

function fixture() {
  const names = ["organizations","organizationMembers","organizationSettings","contacts",
    "lifecycleIntegrationKeys","lifecycleProfiles","lifecycleEvents","lifecycleIngressAudit"];
  const tables = Object.fromEntries(names.map(name => [name, new Map()]));
  let next = 0;
  let user = "owner";
  const insert = (table, value) => {
    const id = table + "_" + (++next);
    tables[table].set(id, { _id:id, ...value }); return id;
  };
  const orgA = insert("organizations", {slug:"pamastore",status:"active"});
  const orgB = insert("organizations", {slug:"track",status:"active"});
  insert("organizationSettings", {organizationId:orgA,preset:"commerce",enabledModules:["lifecycle"]});
  insert("organizationSettings", {organizationId:orgB,preset:"saas",enabledModules:["lifecycle"]});
  for (const [org, subject, role] of [
    [orgA,"owner","owner"],[orgA,"admin","admin"],[orgA,"member","member"],[orgB,"other","owner"]
  ]) insert("organizationMembers",{organizationId:org,userSubject:subject,role});
  const contact = insert("contacts",{
    organizationId:orgA,normalizedEmail:"buyer@example.test",firstName:"Buyer",
  });
  const ctx = {
    auth:{ getUserIdentity: async () => user === null ? null : { subject:user,email:user+"@example.test" } },
    db:{
      get: async id => Object.values(tables).map(t => t.get(id)).find(Boolean) ?? null,
      insert: async (table,fields) => insert(table,fields),
      patch: async (id,fields) => {
        const table = Object.values(tables).find(t => t.has(id));
        if (!table) throw Error("record not found");
        table.set(id, {...table.get(id),...fields});
      },
      query(table) {
        return {
          withIndex(_index,build) {
            const eqs = [];
            const q = {eq(field,value) {eqs.push([field,value]);return q;}};
            build(q);
            const rows = () => [...tables[table].values()].filter(row => eqs.every(([field,v])=>row[field]===v));
            return {
              unique:async () => {const a=rows();if(a.length>1)throw Error("nonunique");return a[0]??null;},
              order(order) {
                const ordered = rows().sort((a,b)=>(a.receivedAt??a.createdAt??0)-(b.receivedAt??b.createdAt??0));
                if(order==="desc")ordered.reverse();
                return {take:async n=>ordered.slice(0,n)};
              },
            };
          }
        };
      },
    },
  };
  return { ctx,orgA,orgB,contact,tables,insert,as(v) {user=v;} };
}

test("contract rejects invalid events and normalizes bounded safe data", () => {
  const input={ organizationSlug:"pamastore", source:"pamastore",environment:"staging",
    eventId:"event-1",type:"order_paid",subjectId:"buyer-9",
    occurredAt:NOW,email:" BUYER@EXAMPLE.TEST ", properties:{orderId:"abc"} };
  assert.equal(normalizeLifecycleEvent(input,NOW).email,"buyer@example.test");
  for (const bad of [
    {...input,environment:"other"},{...input,source:"UPPER"},
    {...input,subjectId:""},{...input,eventId:"!bad"},
    {...input,occurredAt:NOW+10*60_000},
    {...input,properties:[]},{...input,properties:{blob:"a".repeat(8200)}},
  ]) assert.throws(()=>normalizeLifecycleEvent(bad,NOW));
});

test("integration credentials require admin, active Lifecycle and unique hash", async () => {
  const f=fixture();
  const args={organizationId:f.orgA,source:"pamastore",environment:"staging",
    label:"Publisher",tokenHash:HASH,tokenPrefix:"pama_evt_"+"a".repeat(11),expiresAt:NOW+86400000};
  f.as("member");
  await assert.rejects(lifecycle.registerIntegration._handler(f.ctx,args),/admin access/);
  f.as("other");
  await assert.rejects(lifecycle.registerIntegration._handler(f.ctx,args),/do not have access/);
  f.as("admin");
  await lifecycle.registerIntegration._handler(f.ctx,args);
  await assert.rejects(lifecycle.registerIntegration._handler(f.ctx,args),/already exists/);
});

test("ingestion is atomic, idempotent, scoped, rate limited, and contact linked", async () => {
  const f=fixture();
  f.insert("lifecycleIntegrationKeys",{
    organizationId:f.orgA,source:"pamastore",environment:"staging",
    tokenHash:HASH,tokenPrefix:"pama_evt_"+"a".repeat(11),
    expiresAt:NOW+86400000,
  });
  const first=await lifecycle.ingest._handler(f.ctx,common);
  assert.deepEqual(first,{accepted:true,duplicate:false,eventId:"event-1"});
  assert.equal(f.tables.lifecycleEvents.size,1);
  assert.equal(f.tables.lifecycleProfiles.size,1);
  assert.equal([...f.tables.lifecycleProfiles.values()][0].contactId,f.contact);
  const retry=await lifecycle.ingest._handler(f.ctx,common);
  assert.deepEqual(retry,{accepted:true,duplicate:true,eventId:"event-1"});
  assert.equal(f.tables.lifecycleEvents.size,1);
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,type:"order_delivered"}),/different content/);
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,organizationSlug:"track"}),/workspace access denied/);
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,source:"track"}),/Invalid integration credential/);
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,environment:"production"}),/environment mismatch/);
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,bridgeSecret:"wrong"}),/Invalid integration credential/);
  const key=[...f.tables.lifecycleIntegrationKeys.values()][0];
  assert.ok(key.rateCalls >= 2); // In-memory mock does not roll back rejected mutations.
  f.as("member");
  assert.equal((await lifecycle.listEvents._handler(f.ctx,{organizationId:f.orgA})).length,1);
  f.as("other");
  await assert.rejects(lifecycle.listEvents._handler(f.ctx,{organizationId:f.orgA}),/do not have access/);
  f.as("admin");
  await lifecycle.revokeIntegration._handler(f.ctx,{organizationId:f.orgA,integrationId:key._id});
  await assert.rejects(lifecycle.ingest._handler(f.ctx,{...common,eventId:"event-2"}),/Invalid integration credential/);
});
