import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const alias = specifier.startsWith("@/") ?
      pathToFileURL(resolve(process.cwd(), specifier.slice(2))).href : specifier;
    try { return nextResolve(alias, context); }
    catch (error) {
      if (!["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"].includes(error?.code)
          || !(alias.startsWith(".") || alias.startsWith("file:")) || extname(alias)) throw error;
      for (const suffix of [".ts", ".js"]) {
        try { return nextResolve(alias + suffix, context); } catch { /* continue */ }
      }
      throw error;
    }
  }
});
const { ConvexHttpClient } = await import("convex/browser");
const { POST } = await import("../app/api/events/route.ts");
test("event route maps duplicate-payload collision to HTTP 409 and exact replay to 200", async () => {
  const keys = ["NEXT_PUBLIC_CONVEX_URL","CRM_LIFECYCLE_BRIDGE_SECRET","CRM_LIFECYCLE_ENVIRONMENT"];
  const old = keys.map(k => process.env[k]);
  const mutation = ConvexHttpClient.prototype.mutation;
  try {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CRM_LIFECYCLE_BRIDGE_SECRET = "test-secure-bridge-secret-0123456789abcdef";
    process.env.CRM_LIFECYCLE_ENVIRONMENT = "staging";
    const payload = {
      organizationSlug:"pamastore",source:"pamastore",environment:"staging",
      eventId:"order-1",type:"order_paid",subjectId:"buyer-1",
      occurredAt:Date.now(),email:"buyer@example.test",properties:{orderId:"1"}
    };
    const call = () => POST(new Request("https://preview.example.test/api/events",{
      method:"POST", headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer pama_evt_"+"a".repeat(64)
      }, body:JSON.stringify(payload)
    }));
    ConvexHttpClient.prototype.mutation = async () => { throw Error("Event ID already used for different content."); };
    const conflict = await call();
    assert.equal(conflict.status,409);
    assert.deepEqual(await conflict.json(),{error:"Event ID conflicts with an existing event."});
    ConvexHttpClient.prototype.mutation = async () => ({accepted:true,duplicate:true,eventId:"order-1"});
    const replay = await call();
    assert.equal(replay.status,200);
    assert.equal((await replay.json()).duplicate,true);
  } finally {
    ConvexHttpClient.prototype.mutation = mutation;
    for(let i=0;i<keys.length;i++){
      if(old[i] === undefined) delete process.env[keys[i]];
      else process.env[keys[i]]=old[i];
    }
  }
});
