import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMcpToken } from "./mcpAuth";
import { dealStageValidator, contactStatusValidator } from "./crmModels";
const pageArgs={tokenHash:v.string(),organizationSlug:v.string(),cursor:v.optional(v.string()),limit:v.optional(v.number())};
async function organization(ctx:any, tokenHash:string, organizationSlug:string){
  const token=await requireMcpToken(ctx,tokenHash);
  const org=await ctx.db.query("organizations").withIndex("by_slug",(q:any)=>q.eq("slug",organizationSlug.trim().toLowerCase())).unique();
  if(!org||org.status!=="active")throw new Error("Active workspace not found.");
  const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",(q:any)=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
  if(!member)throw new Error("Workspace access denied.");
  return {org,token};
}
function opts(args:{cursor?:string,limit?:number}){return {cursor:args.cursor??null,numItems:Math.min(100,Math.max(1,Math.floor(args.limit??50)))};}
export const pageCompanies=query({args:pageArgs,handler:async(ctx,args)=>{
  const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
  return await ctx.db.query("companies").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").paginate(opts(args));
}});
export const pageContacts=query({args:{...pageArgs,status:v.optional(contactStatusValidator),companyId:v.optional(v.id("companies"))},handler:async(ctx,args)=>{
  const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
  if(args.companyId)return await ctx.db.query("contacts").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",args.companyId)).order("desc").paginate(opts(args));
  if(args.status)return await ctx.db.query("contacts").withIndex("by_organization_and_status",q=>q.eq("organizationId",org._id).eq("status",args.status)).order("desc").paginate(opts(args));
  return await ctx.db.query("contacts").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").paginate(opts(args));
}});
export const pageDeals=query({args:{...pageArgs,stage:v.optional(dealStageValidator),companyId:v.optional(v.id("companies")),pipelineId:v.optional(v.id("pipelines"))},handler:async(ctx,args)=>{
  const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
  if(args.stage)return await ctx.db.query("deals").withIndex("by_organization_and_stage",q=>q.eq("organizationId",org._id).eq("stage",args.stage)).order("desc").paginate(opts(args));
  if(args.companyId)return await ctx.db.query("deals").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",args.companyId)).order("desc").paginate(opts(args));
  if(args.pipelineId)return await ctx.db.query("deals").withIndex("by_organization_and_pipeline",q=>q.eq("organizationId",org._id).eq("pipelineId",args.pipelineId)).order("desc").paginate(opts(args));
  return await ctx.db.query("deals").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").paginate(opts(args));
}});
export const pageActivities=query({args:{...pageArgs,companyId:v.optional(v.id("companies")),contactId:v.optional(v.id("contacts")),dealId:v.optional(v.id("deals"))},handler:async(ctx,args)=>{
  const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
  if(args.companyId)return await ctx.db.query("activities").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",args.companyId)).order("desc").paginate(opts(args));
  if(args.contactId)return await ctx.db.query("activities").withIndex("by_organization_and_contact",q=>q.eq("organizationId",org._id).eq("contactId",args.contactId)).order("desc").paginate(opts(args));
  if(args.dealId)return await ctx.db.query("activities").withIndex("by_organization_and_deal",q=>q.eq("organizationId",org._id).eq("dealId",args.dealId)).order("desc").paginate(opts(args));
  return await ctx.db.query("activities").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").paginate(opts(args));
}});
export const searchAllCompanies=query({
  args:{...pageArgs,search:v.string()},
  handler:async(ctx,args)=>{
    const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
    if(!args.search.trim())throw new Error("Use page_companies for unfiltered listing.");
    return await ctx.db.query("companies").withSearchIndex("search_company",q=>q.search("name",args.search).eq("organizationId",org._id)).paginate(opts(args));
  }
});
export const searchAllContacts=query({
  args:{...pageArgs,search:v.string()},
  handler:async(ctx,args)=>{
    const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
    if(!args.search.trim())throw new Error("Use page_contacts for unfiltered listing.");
    return await ctx.db.query("contacts").withSearchIndex("search_contact",q=>q.search("normalizedName",args.search.toLowerCase()).eq("organizationId",org._id)).paginate(opts(args));
  }
});
export const searchAllDeals=query({
  args:{...pageArgs,search:v.string()},
  handler:async(ctx,args)=>{
    const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
    if(!args.search.trim())throw new Error("Use page_deals for unfiltered listing.");
    return await ctx.db.query("deals").withSearchIndex("search_deal",q=>q.search("name",args.search).eq("organizationId",org._id)).paginate(opts(args));
  }
});
export const bulkCompleteActivities=mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),activityIds:v.array(v.id("activities")),completed:v.boolean()},
  handler:async(ctx,args)=>{
    const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
    if(args.activityIds.length>100)throw new Error("Maximum 100 activities per batch.");
    if(new Set(args.activityIds).size!==args.activityIds.length)throw new Error("Duplicate activity IDs.");
    for(const id of args.activityIds){const a=await ctx.db.get(id);if(!a||a.organizationId!==org._id)throw new Error("Activity not found or outside workspace: "+id);}
    for(const id of args.activityIds)await ctx.db.patch(id,{completedAt:args.completed?Date.now():undefined,updatedAt:Date.now()});
    return {updated:args.activityIds.length,completed:args.completed,activityIds:args.activityIds};
  }
});
export const bulkUpdateContactStatus=mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),contactIds:v.array(v.id("contacts")),status:contactStatusValidator},
  handler:async(ctx,args)=>{
    const {org}=await organization(ctx,args.tokenHash,args.organizationSlug);
    if(args.contactIds.length>100)throw new Error("Maximum 100 contacts per batch.");
    if(new Set(args.contactIds).size!==args.contactIds.length)throw new Error("Duplicate contact IDs.");
    for(const id of args.contactIds){const a=await ctx.db.get(id);if(!a||a.organizationId!==org._id)throw new Error("Contact not found or outside workspace: "+id);}
    for(const id of args.contactIds)await ctx.db.patch(id,{status:args.status,updatedAt:Date.now()});
    return {updated:args.contactIds.length,status:args.status,contactIds:args.contactIds};
  }
});