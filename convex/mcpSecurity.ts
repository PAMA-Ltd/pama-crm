import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMcpToken } from "./mcpAuth";
const permissionValidator=v.union(v.literal("read"),v.literal("write"),v.literal("admin"));
export const authorize = mutation({
  args:{tokenHash:v.string(),permission:permissionValidator,toolName:v.string(),organizationSlug:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    const permission=token.permission??"admin";
    if(args.permission==="admin"&&permission!=="admin")throw new Error("Admin-scoped MCP token required.");
    if(args.permission==="write"&&permission==="read")throw new Error("Write-scoped MCP token required.");
    if(token.organizationId){
      if(!args.organizationSlug && args.toolName!=="list_organizations")throw new Error("This token is restricted to one workspace.");
      const org=args.organizationSlug ? await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug!.trim().toLowerCase())).unique() : await ctx.db.get(token.organizationId);
      if(!org||org._id!==token.organizationId)throw new Error("Token cannot access that workspace.");
    }
    const now=Date.now(),reset=!token.rateWindowAt||now-token.rateWindowAt>=60000;
    const count=reset?1:(token.rateCalls??0)+1;
    if(count>120)throw new Error("Rate limit exceeded: 120 tool calls per minute.");
    await ctx.db.patch(token._id,{rateWindowAt:reset?now:token.rateWindowAt,rateCalls:count});
    return {allowed:true};
  }
});
export const audit = mutation({
  args:{tokenHash:v.string(),toolName:v.string(),organizationSlug:v.optional(v.string()),targetId:v.optional(v.string())},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    let organizationId=undefined;
    if(args.organizationSlug){
      const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug!.trim().toLowerCase())).unique();
      if(org){
        const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
        if(member)organizationId=org._id;
      }
    }
    return await ctx.db.insert("mcpAudit",{organizationId,actorSubject:token.userSubject,toolName:args.toolName.slice(0,100),targetId:args.targetId?.slice(0,100),createdAt:Date.now()});
  }
});
export const listAudit = query({
  args:{tokenHash:v.string(),organizationSlug:v.string(),limit:v.optional(v.number())},
  handler:async(ctx,args)=>{
    const token=await requireMcpToken(ctx,args.tokenHash);
    const org=await ctx.db.query("organizations").withIndex("by_slug",q=>q.eq("slug",args.organizationSlug.trim().toLowerCase())).unique();
    if(!org||org.status!=="active")throw new Error("Active workspace not found.");
    const member=await ctx.db.query("organizationMembers").withIndex("by_organization_and_user",q=>q.eq("organizationId",org._id).eq("userSubject",token.userSubject)).unique();
    if(!member||member.role==="member")throw new Error("Workspace admin required.");
    return await ctx.db.query("mcpAudit").withIndex("by_organization_and_created",q=>q.eq("organizationId",org._id)).order("desc").take(Math.min(250,Math.max(1,Math.floor(args.limit??50))));
  }
});