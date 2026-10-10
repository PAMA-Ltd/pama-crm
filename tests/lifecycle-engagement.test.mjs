import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith("@/") ? pathToFileURL(resolve(process.cwd(),speciferFallback(specifier))).href : specifier;
    try { return nextResolve(alias,context); }
    catch (err) {
      if (!["ERR_MODULE_NOT_FOUND","ERR_UNSUPPORTED_DIR_IMPORT"].includes(err?.code)
          || !(alias.startsWith(".") || alias.startsWith("file:")) || extname(alias)) throw err;
      for (const ext of [".ts",".js"]) {
        try { return nextResolve(alias+ext,context); } catch { /* next */ }
      }
      throw err;
    }
  }
});
function speciferFallback(s) { return s.slice(2); }
const [actions, ingest, helpers] = await Promise.all([
  import("../convex/lifecycleEngagement.ts"),
  import("../convex/lifecycle.ts"),
  import("../lib/lifecycle/engagement.ts"),
]);
process.env.CRM_LIFECYCLE_BRIDGE_SECRET = "safe-test-bridge-secret-123456789abcdef";
process.env.CRM_LIFECYCLE_ENVIRONMENT = "staging";
const SECRET = process.env.CRM_LIFECYCLE_BRIDGE_SECRET;
const HASH = "a".repeat(64);
const baseTime = Date.now();

function fixture(options={}) {
  const names = ["organizations","organizationMembers","organizationSettings","contacts",
    "lifecycleIntegrationKeys","lifecycleProfiles","lifecycleEvents","lifecycleIngressAudit",
    "lifecycleSegments","lifecycleCampaigns","lifecycleAutomations","lifecycleAutomationRuns"];
  const tables = Object.fromEntries(names.map(name=>[name,new Map()]));
  let id=0, user="owner";
  const insert = (table, values) => {
    const key=table+"_"+(++id); tables[table].set(key,{_id:key,...values});return key;
  };
  const a=insert("organizations",{slug:"pamastore",name:"Pamastore",status:"active"});
  const b=insert("organizations",{slug:"track",name:"Track",status:"active"});
  insert("organizationSettings",{organizationId:a,enabledModules:options.modules??["lifecycle","campaigns","automations"]});
  insert("organizationSettings",{organizationId:b,enabledModules:["lifecycle","campaigns","automations"]});
  for (const [organizationId,subject,role] of [
    [a,"owner","owner"],[a,"admin","admin"],[a,"member","member"],[b,"other","owner"]
  ]) insert("organizationMembers",{organizationId,userSubject:subject,role});
  insert("lifecycleIntegrationKeys",{
    organizationId:a,source:"pamastore",environment:"staging",tokenHash:HASH,
    expiresAt:baseTime+86400000,
  });
  const ctx={
    auth:{getUserIdentity:async()=>user===null?null:{subject:user,email:user+"@example.test"}},
    db:{
      get:async key=>Object.values(tables).map(t=>t.get(key)).find(Boolean)??null,
      insert:async(table,values)=>insert(table,values),
      patch:async(key,values)=>{
        const t=Object.values(tables).find(t=>t.has(key));if(!t)throw Error("not found");
        t.set(key,{...t.get(key),...values});
      },
      query(table){
        const build=(filters)=>({
          withIndex(_index,callback){
            const q={eq(field,value){filters.push([field,value]);return q;}};
            callback(q);return build(filters);
          },
          async unique(){
            const arr=this.rows();if(arr.length>1)throw Error("duplicate mock record");return arr[0]??null;
          },
          async take(n){return this.rows().slice(0,n);},
          order(direction){
            const oldRows=this.rows;
            return {...build(filters),rows(){
              const sorted=oldRows().sort((l,r)=>(l.lastSeenAt??l.receivedAt??l.createdAt??0)-
                (r.lastSeenAt??r.receivedAt??r.createdAt??0));
              return direction==="desc"?sorted.reverse():sorted;
            }};
          },
          rows(){return [...tables[table].values()].filter(row=>filters.every(([k,v])=>row[k]===v));},
        });
        return build([]);
      }
    },
  };
  return {ctx,a,b,insert,tables,as(v){user=v;}};
}
const event=(eventId,type,extras={})=>({
  bridgeSecret:SECRET, tokenHash:HASH, organizationSlug:"pamastore",source:"pamastore",
  environment:"staging",eventId,type,subjectId:"buyer-001",
  occurredAt:baseTime,email:"buyer@example.test",propertiesJson:"{}",...extras,
});
const segment=(f,extra={})=>actions.createSegment._handler(f.ctx,{
  organizationId:f.a,name:"Active shoppers",source:"pamastore",...extra,
});

test("audience predicates and email eligibility never treat email as consent",()=>{
  const f={source:"pamastore",lastEventType:"order_paid",tags:["buyer"],email:"buyer@example.test"};
  assert.equal(helpers.matchesSegment(f,{source:"pamastore",lastEventType:"order_paid",requiredTag:"buyer"}),true);
  assert.equal(helpers.matchesSegment(f,{requiredTag:"vip"}),false);
  assert.equal(helpers.eligibleForMarketing(f),false);
  assert.equal(helpers.eligibleForMarketing({...f,marketingConsent:"opt_in"}),true);
  assert.equal(helpers.eligibleForMarketing({...f,marketingConsent:"opt_out"}),false);
  assert.throws(()=>helpers.consentFromEvent("marketing_consent_updated",'{"consent":"yes"}'),/opt_in or opt_out/);
  assert.equal(helpers.consentFromEvent("order_paid",'{}'),null);
});

test("segment mutations are admin-only; previews isolate organizations and suppress unknown consent",async()=>{
  const f=fixture();
  f.as("member");
  await assert.rejects(segment(f),/admin access/);
  f.as("other");
  await assert.rejects(segment(f),/do not have access/);
  f.as("owner");
  const id=await segment(f);
  f.insert("lifecycleProfiles",{organizationId:f.a,source:"pamastore",subjectId:"1",
    lastEventType:"order_paid",lastSeenAt:1,email:"a@example.test"});
  f.insert("lifecycleProfiles",{organizationId:f.a,source:"pamastore",subjectId:"2",
    lastEventType:"order_paid",lastSeenAt:2,email:"b@example.test",marketingConsent:"opt_in"});
  f.insert("lifecycleProfiles",{organizationId:f.b,source:"pamastore",subjectId:"3",
    lastSeenAt:3,email:"c@example.test",marketingConsent:"opt_in"});
  const preview=await actions.previewSegment._handler(f.ctx,{organizationId:f.a,segmentId:id});
  assert.deepEqual(preview,{matched:2,marketingEligible:1,suppressed:1,scanned:2,partial:false});
  f.as("other");
  await assert.rejects(actions.previewSegment._handler(f.ctx,{organizationId:f.a,segmentId:id}),/do not have access/);
  await assert.rejects(actions.createCampaign._handler(f.ctx,{organizationId:f.b,
    segmentId:id,name:"Cross-org",subject:"Hi",body:"Hello"}),/Segment not found/);
});

test("campaign drafts are editable, never dispatched, and archived drafts reject changes",async()=>{
  const f=fixture();const id=await segment(f);
  f.insert("lifecycleProfiles",{organizationId:f.a,source:"pamastore",
    subjectId:"buyer",lastSeenAt:1,email:"e@example.test",marketingConsent:"opt_in"});
  const camp=await actions.createCampaign._handler(f.ctx,{
    organizationId:f.a,segmentId:id,name:"Welcome",subject:"Hello",body:"Hi there"
  });
  const audience=await actions.previewCampaign._handler(f.ctx,{organizationId:f.a,campaignId:camp});
  assert.equal(audience.marketingEligible,1);assert.equal(audience.dispatchEnabled,false);
  await actions.updateCampaign._handler(f.ctx,{organizationId:f.a,campaignId:camp,
    segmentId:id,name:"Welcome again",subject:"Hi",body:"Updated"});
  f.as("member");
  await assert.rejects(actions.archiveCampaign._handler(f.ctx,{organizationId:f.a,campaignId:camp}),/admin access/);
  f.as("owner");
  await actions.archiveCampaign._handler(f.ctx,{organizationId:f.a,campaignId:camp});
  await assert.rejects(actions.updateCampaign._handler(f.ctx,{organizationId:f.a,campaignId:camp,
    segmentId:id,name:"Another",subject:"Hi",body:"Updated"}),/Archived campaigns/);
});

test("activated automations tag new matching events once and do not cross organizations",async()=>{
  const f=fixture();
  const id=await actions.createAutomation._handler(f.ctx,{organizationId:f.a,
    name:"Mark Buyers",source:"pamastore",eventType:"order_paid",tag:"buyer"});
  await actions.setAutomationStatus._handler(f.ctx,{organizationId:f.a,automationId:id,status:"active"});
  const accepted=await ingest.ingest._handler(f.ctx,event("order-1","order_paid"));
  assert.equal(accepted.duplicate,false);
  const profile=[...f.tables.lifecycleProfiles.values()][0];
  assert.deepEqual(profile.tags,["buyer"]);
  assert.equal(f.tables.lifecycleAutomationRuns.size,1);
  const repeat=await ingest.ingest._handler(f.ctx,event("order-1","order_paid"));
  assert.equal(repeat.duplicate,true);
  assert.equal(f.tables.lifecycleAutomationRuns.size,1);
  await ingest.ingest._handler(f.ctx,event("order-2","order_paid"));
  assert.equal(f.tables.lifecycleAutomationRuns.size,2);
  const runs=[...f.tables.lifecycleAutomationRuns.values()];
  assert.deepEqual(runs.map(r=>r.outcome),["tagged","already_tagged"]);
  await actions.setAutomationStatus._handler(f.ctx,{organizationId:f.a,automationId:id,status:"paused"});
  await ingest.ingest._handler(f.ctx,event("order-3","order_paid"));
  assert.equal(f.tables.lifecycleAutomationRuns.size,2);
  f.as("other");
  await assert.rejects(actions.setAutomationStatus._handler(f.ctx,{organizationId:f.a,
    automationId:id,status:"active"}),/do not have access/);
});

test("only explicit and latest consent events update opt-in/out; old events cannot restore consent",async()=>{
  const f=fixture();
  await ingest.ingest._handler(f.ctx,event("agree","marketing_consent_updated",{
    occurredAt:baseTime-1000,propertiesJson:'{"consent":"opt_in"}',
  }));
  let profile=[...f.tables.lifecycleProfiles.values()][0];
  assert.equal(profile.marketingConsent,"opt_in");
  await ingest.ingest._handler(f.ctx,event("unsubscribe","marketing_consent_updated",{
    occurredAt:baseTime,propertiesJson:'{"consent":"opt_out"}',
  }));
  await ingest.ingest._handler(f.ctx,event("delayed-agree","marketing_consent_updated",{
    occurredAt:baseTime-2000,propertiesJson:'{"consent":"opt_in"}',
  }));
  profile=[...f.tables.lifecycleProfiles.values()][0];
  assert.equal(profile.marketingConsent,"opt_out");
  assert.equal(profile.consentUpdatedAt,baseTime);
  await ingest.ingest._handler(f.ctx,event("same-time-agree","marketing_consent_updated",{
    occurredAt:baseTime,propertiesJson:'{"consent":"opt_in"}',
  }));
  profile=[...f.tables.lifecycleProfiles.values()][0];
  assert.equal(profile.marketingConsent,"opt_out"); // tie must fail closed
  const id=await segment(f);
  const audience=await actions.previewSegment._handler(f.ctx,{organizationId:f.a,segmentId:id});
  assert.equal(audience.marketingEligible,0);
  assert.equal(audience.suppressed,1);
});

test("campaigns-only workspace can define and preview segments independently",async()=>{
  const f=fixture({modules:["campaigns"]});
  const id=await segment(f);
  const p=await actions.previewSegment._handler(f.ctx,{organizationId:f.a,segmentId:id});
  assert.equal(p.matched,0);
  await assert.rejects(actions.createAutomation._handler(f.ctx,{organizationId:f.a,
    name:"No",source:"pamastore",eventType:"order_paid",tag:"buyer"}),/module is disabled/);
});

test("segment preview marks incomplete scans and never silently claims full reach",async()=>{
  const f=fixture();const id=await segment(f);
  for(let i=0;i<501;i++) f.insert("lifecycleProfiles",{
    organizationId:f.a,source:"pamastore",subjectId:"p"+i,
    lastSeenAt:i,email:"user"+i+"@example.test",marketingConsent:"opt_in",
  });
  const audience=await actions.previewSegment._handler(f.ctx,{organizationId:f.a,segmentId:id});
  assert.equal(audience.scanned,500);assert.equal(audience.marketingEligible,500);
  assert.equal(audience.partial,true);
});

test("automation tag limits do not reject the source event or create extra tags",async()=>{
  const f=fixture();
  const id=await actions.createAutomation._handler(f.ctx,{organizationId:f.a,
    name:"High tags",eventType:"order_paid",tag:"buyer"});
  await actions.setAutomationStatus._handler(f.ctx,{organizationId:f.a,automationId:id,status:"active"});
  f.insert("lifecycleProfiles",{organizationId:f.a,source:"pamastore",
    subjectId:"buyer-001",email:"buyer@example.test",firstSeenAt:baseTime,
    lastSeenAt:baseTime,tags:Array.from({length:20},(_,i)=>"tag"+i)});
  const result=await ingest.ingest._handler(f.ctx,event("max-tags","order_paid"));
  assert.equal(result.accepted,true);
  const profile=[...f.tables.lifecycleProfiles.values()][0];
  assert.equal(profile.tags.length,20);
  assert.equal([...f.tables.lifecycleAutomationRuns.values()][0].outcome,"skipped_limit");
});

test("disabled automation module never runs rules, and missing email rejects opt-in",async()=>{
  const f=fixture({modules:["lifecycle"]});
  f.insert("lifecycleAutomations",{organizationId:f.a,name:"Disabled",eventType:"order_paid",
    tag:"buyer",status:"active"});
  await ingest.ingest._handler(f.ctx,event("tag-disabled","order_paid"));
  assert.equal(f.tables.lifecycleAutomationRuns.size,0);
  const withoutEmail=fixture();
  await assert.rejects(ingest.ingest._handler(withoutEmail.ctx,
    event("no-email","marketing_consent_updated",{
      email:undefined,propertiesJson:'{"consent":"opt_in"}',
    })),/requires a known email/);
});
