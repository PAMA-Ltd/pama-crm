// Synchronizes the private OAuth bridge secret from Vercel to production Convex.
// Never pass the secret as a CLI argument (visible in process lists and build logs).
import { spawn } from "node:child_process";

const key = process.env.CONVEX_DEPLOY_KEY;
const secret = process.env.CRM_MCP_OAUTH_BRIDGE_SECRET;

if (!key?.startsWith("prod:")) {
  throw new Error("A production CONVEX_DEPLOY_KEY is required for the OAuth sync.");
}
if (!secret || secret.length < 32) {
  throw new Error("CRM_MCP_OAUTH_BRIDGE_SECRET must be set as a sensitive production environment variable.");
}

const child = spawn(
  "npx",
  ["convex", "env", "set", "--prod", "CRM_MCP_OAUTH_BRIDGE_SECRET"],
  { stdio: ["pipe", "pipe", "pipe"], env: process.env },
);
let output = "";
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => { output += chunk; });
}
child.stdin.end(secret);

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", resolve);
});
if (exitCode !== 0) {
  const scrubbed = output.replaceAll(secret, "[REDACTED]");
  throw new Error("Failed to synchronize CRM OAuth secret to Convex: " + scrubbed.slice(-2000));
}
console.log("Convex OAuth bridge secret synchronized.");
