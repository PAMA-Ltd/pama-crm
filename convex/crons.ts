import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons=cronJobs();
crons.interval("Process opted-in CRM email sequences",{minutes:15},internal.mcpMail.processDue,{});
export default crons;
