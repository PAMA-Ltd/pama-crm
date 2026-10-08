import { v } from "convex/values";
import { action, query, mutation, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { requireMcpToken } from "./mcpAuth";
import type { Id } from "./_generated/dataModel";

async function sendMailjet(to:string,subject:string,body:string,reference:string){
  const key=process.env.MAILJET_API_KEY,secret=process.env.MAILJET_SECRET_KEY,from=process.env.CRM_FROM_EMAIL;
  if(process.env.CRM_OUTBOUND_EMAIL_ENABLED!=="true")throw new Error("Outbound email is disabled. Set CRM_OUTBOUND_EMAIL_ENABLED=true on Convex.");
  if(!key||!secret||!from)throw new Error("Configure MAILJET_API_KEY, MAILJET_SECRET_KEY and CRM_FROM_EMAIL in Convex.");
  const response=await fetch("https://api.mailjet.com/v3.1/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Basic "+btoa(key+":"+secret)},body:JSON.stringify({Messages:[{From:{Email:from,Name:"Pama CRM"},To:[{Email:to}],Subject:subject,TextPart:body,CustomID:reference}]})});
  if(!response.ok)throw new Error("Mailjet rejected email: HTTP "+response.status);
  const result=await response.json() as {Messages?:Array<{Status?:string,To?:Array<{MessageID?:number}>}>};
  if(result.Messages?.[0]?.Status!=="success")throw new Error("Mailjet did not acknowledge email delivery.");
  return String(result.Messages[0].To?.[0]?.MessageID??"accepted");
}
export const prepareManual=query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),contactId:v.id("contacts")},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    if(token.permission==="read")throw new Error("Write token required.");
    const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug.trim().toLowerCase())).unique();
    if(!org||org.status!=="active"||(token.organizationId&&token.organizationId!==org._id))throw new Error("Workspace not found.");
    const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
    if(!member)throw new Error("Access denied.");
    const contact=await ctx.db.get(args.contactId);
    if(!contact||contact.organizationId!==org._id||!contact.email)throw new Error("Contact missing or no email address.");
    return {organizationId:org._id,contactId:contact._id,email:contact.email,actor:token.userSubject};
  }
});
export const recordManual=mutation({
  args:{tokenHash:v.string(),organizationSlug:v.string(),contactId:v.id("contacts"),subject:v.string(),messageId:v.string()},
  handler:async(ctx,args)=>{
    const auth=await requireMcpToken(ctx,args.tokenHash);
    const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug.trim().toLowerCase())).unique();
    if(!org||org.status!=="active"||(auth.organizationId&&auth.organizationId!==org._id))throw new Error("Workspace not found.");
    const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",auth.userSubject)).unique();
    const contact=await ctx.db.get(args.contactId);
    if(!member||!contact||contact.organizationId!==org._id)throw new Error("Access denied.");
    const activityId=await ctx.db.insert("activities",{organizationId:org._id,contactId:contact._id,type:"Email",source:"mcp",subject:args.subject,description:"Mailjet accepted message "+args.messageId,createdBy:auth.userSubject,completedAt:Date.now(),updatedAt:Date.now()});
    await ctx.db.insert("emailEvents",{organizationId:org._id,contactId:contact._id,actorSubject:auth.userSubject,subject:args.subject,providerMessageId:args.messageId,kind:"manual",createdAt:Date.now()});
    return {accepted:true,messageId:args.messageId,activityId};
  }
});
export const sendContactEmail=action({
  args:{tokenHash:v.string(),organizationSlug:v.string(),contactId:v.id("contacts"),subject:v.string(),body:v.string(),confirmSend:v.boolean()},
  handler:async(ctx,args)=>{
    if(args.confirmSend!==true)throw new Error("confirmSend=true required to send an external email.");
    const subject=args.subject.trim(),body=args.body.trim();
    if(!subject||subject.length>200||!body||body.length>40000)throw new Error("Valid subject and body required.");
    const target=await ctx.runQuery(makeFunctionReference<"query",typeof args,{organizationId:Id<"organizations">,contactId:Id<"contacts">,email:string,actor:string}>("mcpMail:prepareManual"),{tokenHash:args.tokenHash,organizationSlug:args.organizationSlug,contactId:args.contactId} as typeof args);
    const messageId=await sendMailjet(target.email,subject,body,"pama-manual-"+args.contactId+"-"+Date.now());
    return await ctx.runMutation(makeFunctionReference<"mutation",{tokenHash:string,organizationSlug:string,contactId:Id<"contacts">,subject:string,messageId:string},unknown>("mcpMail:recordManual"),{tokenHash:args.tokenHash,organizationSlug:args.organizationSlug,contactId:args.contactId,subject,messageId});
  }
});
export const listEmailEvents=query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),limit:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug.trim().toLowerCase())).unique();
    if(!org||org.status!=="active"||(token.organizationId&&token.organizationId!==org._id))throw new Error("Workspace not found.");
    const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
    if(!member)throw new Error("Access denied.");
    return await ctx.db.query("emailEvents").withIndex("by_organization",q=>q.eq("organizationId",org._id)).order("desc").take(Math.min(100,Math.max(1,Math.floor(args.limit??30))));
  }
});
export const listEnrollments=query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),sequenceId:v.id("emailSequences"),limit:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug.trim().toLowerCase())).unique();
    if(!org||org.status!=="active"||(token.organizationId&&token.organizationId!==org._id))throw new Error("Workspace not found.");
    const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
    const sequence=await ctx.db.get(args.sequenceId);
    if(!member||!sequence||sequence.organizationId!==org._id)throw new Error("Sequence not found.");
    return await ctx.db.query("sequenceEnrollments").withIndex("by_sequence",q=>q.eq("sequenceId",args.sequenceId)).take(Math.min(500,Math.max(1,Math.floor(args.limit??100))));
  }
});
export const due=internalQuery({
  args:{},
  handler:async ctx=>{
    if(process.env.CRM_AUTOMATION_ENABLED!=="true")return [];
    const now=Date.now();
    const rows=await ctx.db.query("sequenceEnrollments").withIndex("by_status_and_next",q=>q.eq("status","active").lte("nextStepAt",now)).take(20);
    return rows.map(row=>row._id);
  }
});
export const claim=internalMutation({
  args:{enrollmentId:v.id("sequenceEnrollments")},
  handler:async(ctx,args)=>{
    const row=await ctx.db.get(args.enrollmentId);
    if(!row||row.status!=="active"||!row.nextStepAt||row.nextStepAt>Date.now()||row.sendLockedAt)return null;
    const [sequence,contact,org]=await Promise.all([ctx.db.get(row.sequenceId),ctx.db.get(row.contactId),ctx.db.get(row.organizationId)]);
    if(!sequence||sequence.status!=="active"||!contact?.email||!org||org.status!=="active"){
      await ctx.db.patch(row._id,{status:"paused",lastError:"Sequence paused, contact missing email or workspace inactive.",updatedAt:Date.now()});
      return null;
    }
    const step=sequence.steps[row.currentStep];
    if(!step){await ctx.db.patch(row._id,{status:"completed",nextStepAt:undefined,updatedAt:Date.now()});return null;}
    const lockedAt=Date.now();
    await ctx.db.patch(row._id,{sendLockedAt:lockedAt,updatedAt:lockedAt});
    return {enrollmentId:row._id,stepIndex:row.currentStep,lockedAt,contactId:contact._id,organizationId:org._id,to:contact.email,subject:step.subject,body:step.body,actor:sequence.createdBy};
  }
});
export const finish=internalMutation({
  args:{enrollmentId:v.id("sequenceEnrollments"),stepIndex:v.number(),lockedAt:v.number(),success:v.boolean(),messageId:v.optional(v.string()),error:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const row=await ctx.db.get(args.enrollmentId);
    if(!row||row.sendLockedAt!==args.lockedAt||row.currentStep!==args.stepIndex)return null;
    if(!args.success){
      await ctx.db.patch(row._id,{status:"paused",sendLockedAt:undefined,nextStepAt:undefined,lastError:"Mail provider outcome requires review: "+(args.error??"Unknown failure").slice(0,180),updatedAt:Date.now()});
      return {success:false,manualReviewRequired:true};
    }
    const sequence=await ctx.db.get(row.sequenceId);
    if(!sequence)return null;
    const nextStep=args.stepIndex+1,done=nextStep>=sequence.steps.length;
    await ctx.db.patch(row._id,{sendLockedAt:undefined,currentStep:nextStep,status:done?"completed":"active",nextStepAt:done?undefined:Date.now()+Math.max(0,sequence.steps[nextStep].delayDays)*86400000,lastError:undefined,updatedAt:Date.now()});
    await ctx.db.insert("emailEvents",{organizationId:row.organizationId,contactId:row.contactId,actorSubject:sequence.createdBy,subject:sequence.steps[args.stepIndex].subject,providerMessageId:args.messageId??"accepted",kind:"sequence",createdAt:Date.now()});
    await ctx.db.insert("activities",{organizationId:row.organizationId,contactId:row.contactId,type:"Email",source:"system",subject:sequence.steps[args.stepIndex].subject,description:"Mailjet accepted sequence step.",createdBy:sequence.createdBy,completedAt:Date.now(),updatedAt:Date.now()});
    return {success:true,completed:done};
  }
});
export const processDue=internalAction({
  args:{},
  handler:async ctx=>{
    if(process.env.CRM_AUTOMATION_ENABLED!=="true"||process.env.CRM_OUTBOUND_EMAIL_ENABLED!=="true")return;
    const ids=await ctx.runQuery(makeFunctionReference<"query",Record<string, never>,Id<"sequenceEnrollments">[]>("mcpMail:due"),{});
    for(const enrollmentId of ids){
      const claim=await ctx.runMutation(makeFunctionReference<"mutation",{enrollmentId:Id<"sequenceEnrollments">},null|{enrollmentId:Id<"sequenceEnrollments">,stepIndex:number,lockedAt:number,to:string,subject:string,body:string}>("mcpMail:claim"),{enrollmentId});
      if(!claim)continue;
      let success=false,messageId=undefined,error=undefined;
      try{messageId=await sendMailjet(claim.to,claim.subject,claim.body,"pama-sequence-"+enrollmentId+"-"+claim.stepIndex);success=true;}
      catch(e){error=e instanceof Error?e.message:"Provider request failed.";}
      await ctx.runMutation(makeFunctionReference<"mutation",{enrollmentId:Id<"sequenceEnrollments">,stepIndex:number,lockedAt:number,success:boolean,messageId?:string,error?:string},unknown>("mcpMail:finish"),{enrollmentId,stepIndex:claim.stepIndex,lockedAt:claim.lockedAt,success,messageId,error});
    }
  }
});