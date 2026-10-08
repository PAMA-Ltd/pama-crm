import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireMcpToken } from "./mcpAuth";
import { organizationRoleValidator, enrollmentStatusValidator } from "./workspaceModels";

type Ctx = QueryCtx | MutationCtx;
async function workspace(ctx: Ctx, tokenHash: string, organizationSlug: string, role: "member" | "admin" | "owner" = "member") {
  const token = await requireMcpToken(ctx, tokenHash);
  const org = await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", organizationSlug.trim().toLowerCase())).unique();
  if (!org || org.status !== "active") throw new Error("Active workspace not found.");
  const member = await ctx.db.query("organizationMembers").withIndex("by_organization_and_user", q => q.eq("organizationId", org._id).eq("userSubject", token.userSubject)).unique();
  if (!member) throw new Error("Workspace access denied.");
  if (role === "owner" && member.role !== "owner") throw new Error("Workspace owner required.");
  if (role === "admin" && member.role === "member") throw new Error("Workspace admin required.");
  return { token, org, member };
}
const cleanSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);

export const createOrganization = mutation({
  args: { tokenHash: v.string(), name: v.string(), slug: v.optional(v.string()), billingEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const token = await requireMcpToken(ctx, args.tokenHash);
    const name = args.name.trim();
    const slug = cleanSlug(args.slug || name);
    if (!name || !slug) throw new Error("Valid organization name and slug required.");
    const old = await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique();
    if (old) throw new Error("Workspace slug is already taken.");
    const organizationId = await ctx.db.insert("organizations", { name, slug, createdBy: token.userSubject, createdAt: Date.now(), status: "active", planName: "Internal", billingEmail: args.billingEmail?.trim().toLowerCase() });
    await ctx.db.insert("organizationMembers", { organizationId, userSubject: token.userSubject, role: "owner", joinedAt: Date.now() });
    await ctx.db.insert("pipelines", { organizationId, name: "Sales", slug: "sales", isDefault: true, description: "Default sales pipeline", createdAt: Date.now() });
    return { id: organizationId, slug, name };
  }
});
export const updateOrganization = mutation({
  args: { tokenHash: v.string(), organizationSlug: v.string(), name: v.string(), newSlug: v.optional(v.string()), billingEmail: v.optional(v.string()) },
  handler: async (ctx,args) => {
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    if (!args.name.trim()) throw new Error("Organization name required.");
    const slug = cleanSlug(args.newSlug ?? org.slug);
    if (!slug) throw new Error("Valid slug required.");
    const conflict = await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",slug)).unique();
    if (conflict && conflict._id!==org._id) throw new Error("Workspace slug is already taken.");
    await ctx.db.patch(org._id,{name:args.name.trim(),slug,billingEmail:args.billingEmail?.trim().toLowerCase() ?? org.billingEmail});
    return {updated:true,id:org._id,slug,name:args.name.trim()};
  }
});
export const archiveOrganization = mutation({
  args: {tokenHash:v.string(), organizationSlug:v.string(), confirmSlug:v.string()},
  handler: async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"owner");
    if(args.confirmSlug!==org.slug)throw new Error("Explicit workspace slug confirmation is required.");
    await ctx.db.patch(org._id,{status:"archived"});
    return {archived:true,slug:org.slug};
  }
});
export const listInvitations = query({
  args:{tokenHash:v.string(),organizationSlug:v.string()},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    return await ctx.db.query("organizationInvites").withIndex("by_organization",q=>q.eq("organizationId",org._id)).take(250);
  }
});
export const inviteMember = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),email:v.string(),role:organizationRoleValidator},
  handler:async(ctx,args)=>{
    const {org,token,member}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    if(args.role==="owner"&&member.role!=="owner")throw new Error("Only owners can invite owners.");
    const email=args.email.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error("Valid email required.");
    const found=await ctx.db.query("organizationInvites").withIndex("by_organization_and_email",q=>q.eq("organizationId",org._id).eq("email",email)).take(20);
    if(found.some(i=>i.status==="pending"&&i.expiresAt>Date.now()))throw new Error("Pending invitation exists.");
    const id=await ctx.db.insert("organizationInvites",{organizationId:org._id,email,role:args.role,status:"pending",createdBy:token.userSubject,createdAt:Date.now(),expiresAt:Date.now()+14*86400000});
    return {id,email,role:args.role,status:"pending",delivery:"Invitation recorded; email delivery is not configured."};
  }
});
export const changeMemberRole = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),memberId:v.id("organizationMembers"),role:organizationRoleValidator},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"owner");
    const member=await ctx.db.get(args.memberId);
    if(!member||member.organizationId!==org._id)throw new Error("Member not found.");
    if(member.role==="owner"&&args.role!=="owner"){
      const owners=await ctx.db.query("organizationMembers").withIndex("by_organization",q=>q.eq("organizationId",org._id)).collect();
      if(owners.filter(m=>m.role==="owner").length<=1)throw new Error("Cannot remove the only owner.");
    }
    await ctx.db.patch(args.memberId,{role:args.role});
    return {memberId:args.memberId,role:args.role};
  }
});
export const createTeam = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),name:v.string(),description:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    const name=args.name.trim();const slug=cleanSlug(name);
    if(!slug)throw new Error("Team name required.");
    const old=await ctx.db.query("teams").withIndex("by_organization_and_slug",q=>q.eq("organizationId",org._id).eq("slug",slug)).unique();
    if(old)throw new Error("Team already exists.");
    const id=await ctx.db.insert("teams",{organizationId:org._id,name,slug,description:args.description,createdAt:Date.now()});
    return {id,name,slug};
  }
});
export const assignTeam = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),memberId:v.id("organizationMembers"),teamId:v.union(v.id("teams"),v.null())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    const member=await ctx.db.get(args.memberId);
    if(!member||member.organizationId!==org._id)throw new Error("Member not found.");
    if(args.teamId){const team=await ctx.db.get(args.teamId);if(!team||team.organizationId!==org._id)throw new Error("Team not found.");}
    await ctx.db.patch(args.memberId,{teamId:args.teamId??undefined});
    return {memberId:args.memberId,teamId:args.teamId};
  }
});
export const deleteTeam = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),teamId:v.id("teams")},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    const team=await ctx.db.get(args.teamId);
    if(!team||team.organizationId!==org._id)throw new Error("Team not found.");
    const assigned=await ctx.db.query("organizationMembers").withIndex("by_organization_and_team",q=>q.eq("organizationId",org._id).eq("teamId",args.teamId)).first();
    if(assigned)throw new Error("Reassign team members before deleting.");
    await ctx.db.delete(args.teamId);return {deleted:true,teamId:args.teamId};
  }
});
export const updatePipeline = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),pipelineId:v.id("pipelines"),name:v.string(),description:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug,"admin");
    const pipe=await ctx.db.get(args.pipelineId);
    if(!pipe||pipe.organizationId!==org._id)throw new Error("Pipeline not found.");
    const name=args.name.trim(),slug=cleanSlug(name);
    if(!slug)throw new Error("Pipeline name required.");
    const conflict=await ctx.db.query("pipelines").withIndex("by_organization_and_slug",q=>q.eq("organizationId",org._id).eq("slug",slug)).unique();
    if(conflict&&conflict._id!==pipe._id)throw new Error("Pipeline slug already exists.");
    await ctx.db.patch(pipe._id,{name,slug,description:args.description??pipe.description});
    return {id:pipe._id,name,slug};
  }
});
export const getCompany = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),companyId:v.id("companies")},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const company=await ctx.db.get(args.companyId);
    if(!company||company.organizationId!==org._id)throw new Error("Company not found.");
    const [contacts,deals,activities]=await Promise.all([
      ctx.db.query("contacts").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).take(100),
      ctx.db.query("deals").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).take(100),
      ctx.db.query("activities").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).order("desc").take(100)
    ]);
    return {company,contacts,deals,activities,relatedRecordsLimitedTo:100};
  }
});
export const getContact = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),contactId:v.id("contacts")},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const contact=await ctx.db.get(args.contactId);
    if(!contact||contact.organizationId!==org._id)throw new Error("Contact not found.");
    return contact;
  }
});
export const getDeal = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),dealId:v.id("deals")},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const deal=await ctx.db.get(args.dealId);
    if(!deal||deal.organizationId!==org._id)throw new Error("Deal not found.");
    return deal;
  }
});
export const getCompanyInsights = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),companyId:v.id("companies"),days:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const company=await ctx.db.get(args.companyId);
    if(!company||company.organizationId!==org._id)throw new Error("Company not found.");
    const days=Math.min(90,Math.max(7,Math.floor(args.days??30)));
    const [activities,deals,contacts]=await Promise.all([
      ctx.db.query("activities").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).collect(),
      ctx.db.query("deals").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).collect(),
      ctx.db.query("contacts").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",company._id)).collect()
    ]);
    const now=Date.now(), windowStart=now-days*86400000;
    const recent=activities.filter(a=>a._creationTime>=windowStart).length;
    const open=deals.filter(d=>d.stage!=="Won"&&d.stage!=="Lost");
    return {companyId:company._id,days,activities:recent,contacts:contacts.length,openDeals:open.length,openValue:open.reduce((n,d)=>n+d.amount,0),
      averageWinProbability:open.length?Math.round(open.reduce((n,d)=>n+d.probability,0)/open.length):0,
      engagementScore:Math.min(100,recent*12+contacts.length*8)};
  }
});
export const notifications = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),limit:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const limit=Math.min(100,Math.max(1,Math.floor(args.limit??30)));
    const activities=await ctx.db.query("activities").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").take(limit);
    return activities.map(a=>({id:a._id,title:a.subject,description:a.description,type:a.type,createdAt:a._creationTime,overdue:!!a.dueAt&&!a.completedAt&&a.dueAt<Date.now()}));
  }
});
export const updateSequenceEnrollment = mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),enrollmentId:v.id("sequenceEnrollments"),status:enrollmentStatusValidator,confirmRetry:v.optional(v.boolean())},
  handler:async(ctx,args)=>{
    const {org}=await workspace(ctx,args.tokenHash,args.organizationSlug);
    const enrollment=await ctx.db.get(args.enrollmentId);
    if(!enrollment||enrollment.organizationId!==org._id)throw new Error("Enrollment not found.");
    if(args.status==="active"&&enrollment.lastError&&args.confirmRetry!==true)throw new Error("Delivery outcome is uncertain. Review the provider first; pass confirmRetry=true to resume.");
    await ctx.db.patch(args.enrollmentId,{status:args.status,
      nextStepAt:args.status==="active"?Date.now():enrollment.nextStepAt,
      sendLockedAt:args.status==="active"?undefined:enrollment.sendLockedAt,
      lastError:args.status==="active"?undefined:enrollment.lastError,
      updatedAt:Date.now()});
    return {id:args.enrollmentId,status:args.status};
  }
});
