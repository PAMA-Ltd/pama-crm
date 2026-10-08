import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireMcpToken } from "./mcpAuth";
import { contactStatusValidator, dealStageValidator } from "./crmModels";
import type { Id } from "./_generated/dataModel";
async function orgFor(ctx:any,tokenHash:string,organizationSlug:string){
  const token=await requireMcpToken(ctx,tokenHash);
  if(token.permission==="read")throw new Error("Write permission required.");
  const org=await ctx.db.query("organizations").withIndex("by_slug",(q:any)=>q.eq("slug",organizationSlug.trim().toLowerCase())).unique();
  if(!org || org.status!=="active" || (token.organizationId&&token.organizationId!==org._id))throw new Error("Workspace not found.");
  const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",(q:any)=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
  if(!member)throw new Error("Workspace access denied.");
  return {org,token};
}
export const importContacts=mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),rows:v.array(v.object({firstName:v.string(),lastName:v.string(),email:v.optional(v.string()),phone:v.optional(v.string()),companyId:v.optional(v.id("companies")),status:v.optional(contactStatusValidator),notes:v.optional(v.string())}))},
  handler:async(ctx,args)=>{
    const {org,token}=await orgFor(ctx,args.tokenHash,args.organizationSlug);
    if(args.rows.length>100)throw new Error("Maximum 100 contacts per batch.");
    const created:Id<"contacts">[]=[],skipped:Array<{row:number,reason:string}>=[];
    const seen=new Set<string>();
    for(const [index,row] of args.rows.entries()){
      const first=row.firstName.trim(),last=row.lastName.trim(),email=row.email?.trim().toLowerCase();
      if(!first||!last){skipped.push({row:index+1,reason:"Missing name."});continue;}
      if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||seen.has(email))){skipped.push({row:index+1,reason:"Invalid or duplicate email in import."});continue;}
      if(row.companyId){
        const company=await ctx.db.get(row.companyId);
        if(!company||company.organizationId!==org._id){skipped.push({row:index+1,reason:"Company not in workspace."});continue;}
      }
      if(email){
        const existing=await ctx.db.query("contacts").withIndex("by_organization_and_email",q=>q.eq("organizationId",org._id).eq("normalizedEmail",email)).first();
        if(existing){skipped.push({row:index+1,reason:"Email already exists."});continue;}
        seen.add(email);
      }
      created.push(await ctx.db.insert("contacts",{organizationId:org._id,firstName:first,lastName:last,normalizedName:(first+" "+last).toLowerCase(),email,normalizedEmail:email,phone:row.phone?.trim(),companyId:row.companyId,status:row.status??"Lead",notes:row.notes,ownerSubject:token.userSubject,createdBy:token.userSubject,updatedAt:Date.now()}));
    }
    return {created:created.length,ids:created,skippedCount:skipped.length,skipped};
  }
});
export const importDeals=mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),rows:v.array(v.object({name:v.string(),companyId:v.id("companies"),contactId:v.optional(v.id("contacts")),pipelineId:v.optional(v.id("pipelines")),amount:v.number(),stage:dealStageValidator,expectedCloseDate:v.optional(v.string()),notes:v.optional(v.string())}))},
  handler:async(ctx,args)=>{
    const {org,token}=await orgFor(ctx,args.tokenHash,args.organizationSlug);
    if(args.rows.length>100)throw new Error("Maximum 100 deals per batch.");
    const stageProbability:Record<string,number>={Lead:10,Qualified:25,Proposal:50,Negotiation:75,Won:100,Lost:0};
    const created:Id<"deals">[]=[],skipped:Array<{row:number,reason:string}>=[];
    const affected=new Set<Id<"companies">>();
    for(const [index,row] of args.rows.entries()){
      const name=row.name.trim();
      if(!name||!Number.isFinite(row.amount)||row.amount<0){skipped.push({row:index+1,reason:"Invalid name/amount."});continue;}
      const company=await ctx.db.get(row.companyId);
      if(!company||company.organizationId!==org._id){skipped.push({row:index+1,reason:"Company not in workspace."});continue;}
      if(row.contactId){const contact=await ctx.db.get(row.contactId);if(!contact||contact.organizationId!==org._id){skipped.push({row:index+1,reason:"Contact not in workspace."});continue;}}
      if(row.pipelineId){const pipeline=await ctx.db.get(row.pipelineId);if(!pipeline||pipeline.organizationId!==org._id){skipped.push({row:index+1,reason:"Pipeline not in workspace."});continue;}}
      if(row.expectedCloseDate&&!/^\d{4}-\d{2}-\d{2}$/.test(row.expectedCloseDate)){skipped.push({row:index+1,reason:"Invalid close date."});continue;}
      const id=await ctx.db.insert("deals",{organizationId:org._id,name,companyId:row.companyId,contactId:row.contactId,pipelineId:row.pipelineId,amount:row.amount,stage:row.stage,probability:stageProbability[row.stage],expectedCloseDate:row.expectedCloseDate,notes:row.notes,createdBy:token.userSubject,updatedAt:Date.now()});
      created.push(id);affected.add(row.companyId);
    }
    for(const companyId of affected){
      const deals=await ctx.db.query("deals").withIndex("by_organization_and_company",q=>q.eq("organizationId",org._id).eq("companyId",companyId)).collect();
      const active=deals.filter(d=>d.stage!=="Won"&&d.stage!=="Lost");
      const value=active.reduce((sum,d)=>sum+d.amount,0);
      const weighted=active.reduce((sum,d)=>sum+d.amount*d.probability,0);
      await ctx.db.patch(companyId,{openDeals:active.length,pipelineValue:Math.round(value),winProbability:value>0?Math.round(weighted/value):0});
    }
    return {created:created.length,ids:created,skippedCount:skipped.length,skipped};
  }
});