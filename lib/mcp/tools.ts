import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: boolean;
  };
};

type JsonObject = Record<string, unknown>;

const organizationSlug = {
  type: "string",
  description:
    "Unique organization/workspace slug. Call list_organizations first when unsure.",
};

const id = (description: string) => ({
  type: "string",
  description,
});

const optionalLimit = {
  type: "number",
  minimum: 1,
  maximum: 500,
  description: "Maximum number of records to return.",
};

const stage = {
  type: "string",
  enum: ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"],
};

const contactStatus = {
  type: "string",
  enum: ["Lead", "Active", "Customer", "Inactive"],
};

const companyTags = {
  type: "array",
  items: {
    type: "string",
    enum: [
      "Enterprise",
      "Mid-Market",
      "SMB",
      "Strategic",
      "New Logo",
      "Upsell",
      "Expansion",
      "Renewal",
      "Pilot",
      "Co-Sell",
      "Land & Expand",
    ],
  },
};

export const MCP_TOOLS: ToolDefinition[] = [
  {"name":"create_organization","description":"Create a new workspace and default pipeline. The token holder becomes its owner.","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"slug":{"type":"string"},"billingEmail":{"type":"string"}},"required":["name"],"additionalProperties":false}},
  {"name":"update_organization","description":"Update workspace identity; requires organization admin.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"name":{"type":"string"},"newSlug":{"type":"string"},"billingEmail":{"type":"string"}},"required":["organizationSlug","name"],"additionalProperties":false}},
  {"name":"archive_organization","description":"Archive a workspace; requires owner and explicit slug confirmation.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"confirmSlug":{"type":"string"}},"required":["organizationSlug","confirmSlug"],"additionalProperties":false}},
  {"name":"list_organization_invitations","description":"List workspace invitations; admins only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"}},"required":["organizationSlug"],"additionalProperties":false}},
  {"name":"invite_organization_member","description":"Create a workspace invitation. Does not send an email.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"email":{"type":"string"},"role":{"type":"string","enum":["owner","admin","member"]}},"required":["organizationSlug","email","role"],"additionalProperties":false}},
  {"name":"change_member_role","description":"Change an existing member role; owner only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"memberId":{"type":"string"},"role":{"type":"string","enum":["owner","admin","member"]}},"required":["organizationSlug","memberId","role"],"additionalProperties":false}},
  {"name":"create_team","description":"Create workspace team; admins only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"}},"required":["organizationSlug","name"],"additionalProperties":false}},
  {"name":"assign_member_team","description":"Assign member to team or unlink with null; admins only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"memberId":{"type":"string"},"teamId":{"type":["string","null"]}},"required":["organizationSlug","memberId","teamId"],"additionalProperties":false}},
  {"name":"delete_team","description":"Delete empty team; admins only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"teamId":{"type":"string"}},"required":["organizationSlug","teamId"],"additionalProperties":false}},
  {"name":"update_pipeline","description":"Update pipeline name/description; admins only.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"pipelineId":{"type":"string"},"name":{"type":"string"},"description":{"type":"string"}},"required":["organizationSlug","pipelineId","name"],"additionalProperties":false}},
  {"name":"get_company","description":"Get company details and up to 100 related records for each relation.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"companyId":{"type":"string"}},"required":["organizationSlug","companyId"],"additionalProperties":false}},
  {"name":"get_contact","description":"Retrieve full contact by ID.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"contactId":{"type":"string"}},"required":["organizationSlug","contactId"],"additionalProperties":false}},
  {"name":"get_deal","description":"Retrieve full deal by ID.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"dealId":{"type":"string"}},"required":["organizationSlug","dealId"],"additionalProperties":false}},
  {"name":"get_company_insights","description":"Get company engagement, deal health and counts.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"companyId":{"type":"string"},"days":{"type":"number","minimum":7,"maximum":90}},"required":["organizationSlug","companyId"],"additionalProperties":false}},
  {"name":"list_notifications","description":"List CRM activity notifications.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"limit":{"type":"number","minimum":1,"maximum":100}},"required":["organizationSlug"],"additionalProperties":false}},
  {"name":"set_sequence_enrollment_status","description":"Pause, resume or unsubscribe an enrollment.","inputSchema":{"type":"object","properties":{"organizationSlug":{"type":"string"},"enrollmentId":{"type":"string"},"status":{"type":"string","enum":["active","paused","completed","unsubscribed"]}},"required":["organizationSlug","enrollmentId","status"],"additionalProperties":false}},
  {
    name: "list_organizations",
    description:
      "List every CRM organization/workspace the connected user can access, including each stable slug and role. Use this before acting when the organization is ambiguous.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_organization_summary",
    description:
      "Get a high-level CRM summary for one organization: record counts, overdue work, pipeline, weighted forecast and won revenue.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "search_companies",
    description:
      "Search/list companies (accounts/leads) in one organization. Returns IDs needed for contact, deal and activity relationships.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        search: { type: "string" },
        limit: optionalLimit,
      },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_company",
    description: "Create a company/account in an organization.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        name: { type: "string" },
        tags: companyTags,
        ownerSubject: {
          type: "string",
          description:
            "Optional Clerk user subject of an organization member. Omit to assign the connected user.",
        },
        lastInteraction: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
            label: { type: "string" },
          },
          required: ["date", "label"],
          additionalProperties: false,
        },
      },
      required: ["organizationSlug", "name", "tags"],
      additionalProperties: false,
    },
  },
  {
    name: "update_company",
    description:
      "Update a company/account. Only supplied fields are changed; deal-derived pipeline metrics remain automatic.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        companyId: id("Company ID returned by search_companies."),
        name: { type: "string" },
        tags: companyTags,
        ownerSubject: { type: "string" },
        lastInteraction: {
          type: "object",
          properties: {
            date: { type: "string" },
            label: { type: "string" },
          },
          required: ["date", "label"],
          additionalProperties: false,
        },
      },
      required: ["organizationSlug", "companyId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_company",
    description:
      "Delete a company only when no contacts, deals or activities still reference it.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        companyId: id("Company ID."),
      },
      required: ["organizationSlug", "companyId"],
      additionalProperties: false,
    },
  },
  {
    name: "import_companies",
    description:
      "Bulk-create up to 500 companies in one organization. Duplicate company names are safely skipped.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        rows: {
          type: "array",
          maxItems: 500,
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              tags: companyTags,
            },
            required: ["name", "tags"],
            additionalProperties: false,
          },
        },
      },
      required: ["organizationSlug", "rows"],
      additionalProperties: false,
    },
  },
  {
    name: "search_contacts",
    description:
      "Search/list contacts in an organization, optionally by company or contact status.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        search: { type: "string" },
        companyId: id("Optional company ID."),
        status: contactStatus,
        limit: optionalLimit,
      },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_contact",
    description: "Create a CRM contact and optionally link the person to a company.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        companyId: id("Optional company ID."),
        status: contactStatus,
        notes: { type: "string" },
      },
      required: ["organizationSlug", "firstName", "lastName", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "update_contact",
    description:
      "Update a CRM contact. Set companyId to null to unlink the contact from a company.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        contactId: id("Contact ID."),
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        title: { type: "string" },
        companyId: { type: ["string", "null"] },
        status: contactStatus,
        notes: { type: "string" },
      },
      required: ["organizationSlug", "contactId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_contact",
    description:
      "Delete a contact. The operation is blocked while a deal still references the contact.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        contactId: id("Contact ID."),
      },
      required: ["organizationSlug", "contactId"],
      additionalProperties: false,
    },
  },
  {
    name: "search_deals",
    description:
      "Search/list commercial opportunities in an organization, optionally filtered by stage, company or pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        search: { type: "string" },
        stage,
        companyId: id("Optional company ID."),
        pipelineId: id("Optional pipeline ID."),
        limit: optionalLimit,
      },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_deal",
    description:
      "Create a deal/opportunity. Company is required; contact and pipeline are optional.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        name: { type: "string" },
        companyId: id("Company ID."),
        contactId: id("Optional contact ID."),
        pipelineId: id("Optional pipeline ID."),
        amount: { type: "number", minimum: 0 },
        stage,
        expectedCloseDate: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
      },
      required: [
        "organizationSlug",
        "name",
        "companyId",
        "amount",
        "stage",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "update_deal",
    description:
      "Update a deal. Set contactId or pipelineId to null to unlink it. Stage changes automatically write CRM activity and refresh company metrics.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        dealId: id("Deal ID."),
        name: { type: "string" },
        companyId: id("Company ID."),
        contactId: { type: ["string", "null"] },
        pipelineId: { type: ["string", "null"] },
        amount: { type: "number", minimum: 0 },
        stage,
        expectedCloseDate: { type: "string" },
        notes: { type: "string" },
      },
      required: ["organizationSlug", "dealId"],
      additionalProperties: false,
    },
  },
  {
    name: "change_deal_stage",
    description:
      "Move a deal to another stage. Probability and company pipeline metrics update automatically and a timeline activity is recorded.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        dealId: id("Deal ID."),
        stage,
      },
      required: ["organizationSlug", "dealId", "stage"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_deal",
    description:
      "Delete a deal and unlink its historical activities from the deleted deal while preserving those activities.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        dealId: id("Deal ID."),
      },
      required: ["organizationSlug", "dealId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_activities",
    description:
      "List CRM calls, emails, meetings, notes and tasks. Can filter by company, contact, deal or open-only.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        openOnly: { type: "boolean" },
        companyId: id("Optional company ID."),
        contactId: id("Optional contact ID."),
        dealId: id("Optional deal ID."),
        limit: optionalLimit,
      },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_activity",
    description:
      "Create a call, email, meeting, note or task, optionally linked to CRM records.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        type: {
          type: "string",
          enum: ["Call", "Email", "Meeting", "Note", "Task"],
        },
        subject: { type: "string" },
        description: { type: "string" },
        companyId: id("Optional company ID."),
        contactId: id("Optional contact ID."),
        dealId: id("Optional deal ID."),
        dueAt: {
          type: "number",
          description: "Optional due time as Unix milliseconds.",
        },
      },
      required: ["organizationSlug", "type", "subject"],
      additionalProperties: false,
    },
  },
  {
    name: "update_activity",
    description:
      "Update an activity. Relationship fields can be set to null to unlink them.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        activityId: id("Activity ID."),
        type: {
          type: "string",
          enum: ["Call", "Email", "Meeting", "Note", "Task"],
        },
        subject: { type: "string" },
        description: { type: "string" },
        companyId: { type: ["string", "null"] },
        contactId: { type: ["string", "null"] },
        dealId: { type: ["string", "null"] },
        dueAt: { type: ["number", "null"] },
      },
      required: ["organizationSlug", "activityId"],
      additionalProperties: false,
    },
  },
  {
    name: "complete_activity",
    description: "Mark an activity completed or reopen it.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        activityId: id("Activity ID."),
        completed: { type: "boolean" },
      },
      required: ["organizationSlug", "activityId", "completed"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_activity",
    description: "Delete an activity.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        activityId: id("Activity ID."),
      },
      required: ["organizationSlug", "activityId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_pipelines",
    description: "List real deal pipelines and their current deal/value totals.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_pipeline",
    description: "Create a pipeline. Requires organization admin/owner access.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        name: { type: "string" },
        description: { type: "string" },
      },
      required: ["organizationSlug", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_pipeline",
    description:
      "Delete a non-default empty pipeline. Requires organization admin/owner access.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        pipelineId: id("Pipeline ID."),
      },
      required: ["organizationSlug", "pipelineId"],
      additionalProperties: false,
    },
  },
  {
    name: "list_team_members",
    description:
      "List organization teams and members, including member IDs, names, emails, roles and team relationships.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_email_sequences",
    description: "List stored email outreach sequences and enrollment counts.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "create_email_sequence",
    description:
      "Create an email sequence definition. Requires admin/owner access. This stores the outreach plan; it does not fabricate sending.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        name: { type: "string" },
        status: {
          type: "string",
          enum: ["draft", "active", "paused"],
        },
        steps: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              delayDays: { type: "number", minimum: 0 },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["delayDays", "subject", "body"],
            additionalProperties: false,
          },
        },
      },
      required: ["organizationSlug", "name", "status", "steps"],
      additionalProperties: false,
    },
  },
  {
    name: "update_email_sequence",
    description:
      "Update an email sequence definition. Requires admin/owner access.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        sequenceId: id("Email sequence ID."),
        name: { type: "string" },
        status: {
          type: "string",
          enum: ["draft", "active", "paused"],
        },
        steps: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              delayDays: { type: "number", minimum: 0 },
              subject: { type: "string" },
              body: { type: "string" },
            },
            required: ["delayDays", "subject", "body"],
            additionalProperties: false,
          },
        },
      },
      required: ["organizationSlug", "sequenceId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_email_sequence",
    description:
      "Delete an email sequence and its enrollments. Requires admin/owner access.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        sequenceId: id("Email sequence ID."),
      },
      required: ["organizationSlug", "sequenceId"],
      additionalProperties: false,
    },
  },
  {
    name: "enroll_contact_in_sequence",
    description:
      "Enroll a CRM contact in a stored email sequence. This records enrollment; mail delivery still depends on a configured provider.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        sequenceId: id("Email sequence ID."),
        contactId: id("Contact ID."),
      },
      required: ["organizationSlug", "sequenceId", "contactId"],
      additionalProperties: false,
    },
  },
  {
    name: "forecast_summary",
    description:
      "Return live open pipeline, weighted forecast, won revenue and win rate for an organization.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "slipping_deals",
    description:
      "List open deals whose expected close date has passed, ordered by how late they are.",
    inputSchema: {
      type: "object",
      properties: {
        organizationSlug,
        limit: optionalLimit,
      },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
  {
    name: "attention_summary",
    description:
      "Get the organization's actionable attention queue: overdue activities, slipping deals, and high-value companies with no interaction in 14+ days.",
    inputSchema: {
      type: "object",
      properties: { organizationSlug },
      required: ["organizationSlug"],
      additionalProperties: false,
    },
  },
];

const operationMap: Record<
  string,
  { kind: "query" | "mutation"; fn: string }
> = {
  get_organization_summary: { kind: "query", fn: "mcp:organizationSummary" },
  create_organization: { kind: "mutation", fn: "mcpExpanded:createOrganization" },
  update_organization: { kind: "mutation", fn: "mcpExpanded:updateOrganization" },
  archive_organization: { kind: "mutation", fn: "mcpExpanded:archiveOrganization" },
  list_organization_invitations: { kind: "query", fn: "mcpExpanded:listInvitations" },
  invite_organization_member: { kind: "mutation", fn: "mcpExpanded:inviteMember" },
  change_member_role: { kind: "mutation", fn: "mcpExpanded:changeMemberRole" },
  create_team: { kind: "mutation", fn: "mcpExpanded:createTeam" },
  assign_member_team: { kind: "mutation", fn: "mcpExpanded:assignTeam" },
  delete_team: { kind: "mutation", fn: "mcpExpanded:deleteTeam" },
  update_pipeline: { kind: "mutation", fn: "mcpExpanded:updatePipeline" },
  get_company: { kind: "query", fn: "mcpExpanded:getCompany" },
  get_contact: { kind: "query", fn: "mcpExpanded:getContact" },
  get_deal: { kind: "query", fn: "mcpExpanded:getDeal" },
  get_company_insights: { kind: "query", fn: "mcpExpanded:getCompanyInsights" },
  list_notifications: { kind: "query", fn: "mcpExpanded:notifications" },
  set_sequence_enrollment_status: { kind: "mutation", fn: "mcpExpanded:updateSequenceEnrollment" },
  search_companies: { kind: "query", fn: "mcp:searchCompanies" },
  create_company: { kind: "mutation", fn: "mcp:createCompany" },
  update_company: { kind: "mutation", fn: "mcp:updateCompany" },
  delete_company: { kind: "mutation", fn: "mcp:deleteCompany" },
  import_companies: { kind: "mutation", fn: "mcp:importCompanies" },
  search_contacts: { kind: "query", fn: "mcp:searchContacts" },
  create_contact: { kind: "mutation", fn: "mcp:createContact" },
  update_contact: { kind: "mutation", fn: "mcp:updateContact" },
  delete_contact: { kind: "mutation", fn: "mcp:deleteContact" },
  search_deals: { kind: "query", fn: "mcp:searchDeals" },
  create_deal: { kind: "mutation", fn: "mcp:createDeal" },
  update_deal: { kind: "mutation", fn: "mcp:updateDeal" },
  change_deal_stage: { kind: "mutation", fn: "mcp:changeDealStage" },
  delete_deal: { kind: "mutation", fn: "mcp:deleteDeal" },
  list_activities: { kind: "query", fn: "mcp:listActivities" },
  create_activity: { kind: "mutation", fn: "mcp:createActivity" },
  update_activity: { kind: "mutation", fn: "mcp:updateActivity" },
  complete_activity: { kind: "mutation", fn: "mcp:completeActivity" },
  delete_activity: { kind: "mutation", fn: "mcp:deleteActivity" },
  list_pipelines: { kind: "query", fn: "mcp:listPipelines" },
  create_pipeline: { kind: "mutation", fn: "mcp:createPipeline" },
  delete_pipeline: { kind: "mutation", fn: "mcp:deletePipeline" },
  list_team_members: { kind: "query", fn: "mcp:listPeople" },
  list_email_sequences: { kind: "query", fn: "mcp:listSequences" },
  create_email_sequence: { kind: "mutation", fn: "mcp:createSequence" },
  update_email_sequence: { kind: "mutation", fn: "mcp:updateSequence" },
  delete_email_sequence: { kind: "mutation", fn: "mcp:deleteSequence" },
  enroll_contact_in_sequence: { kind: "mutation", fn: "mcp:enrollContact" },
  forecast_summary: { kind: "query", fn: "mcp:forecast" },
  slipping_deals: { kind: "query", fn: "mcp:slippingDeals" },
  attention_summary: { kind: "query", fn: "mcp:attentionSummary" },
};

function convexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
  return new ConvexHttpClient(url);
}

export async function authenticateMcpToken(tokenHash: string) {
  const client = convexClient();
  const reference = makeFunctionReference<
    "query",
    { tokenHash: string },
    {
      userSubject: string;
      tokenPrefix: string;
      organizations: Array<{
        id: string;
        name: string;
        slug: string;
        role: "owner" | "admin" | "member";
        status: "active" | "archived";
      }>;
    }
  >("mcp:authenticate");
  return await client.query(reference, { tokenHash });
}

export async function callMcpTool(
  name: string,
  input: JsonObject,
  tokenHash: string,
) {
  if (name === "list_organizations") {
    const auth = await authenticateMcpToken(tokenHash);
    return auth.organizations;
  }

  const operation = operationMap[name];
  if (!operation) throw new Error(`Unknown MCP tool: ${name}`);

  const args: JsonObject = { ...input, tokenHash };
  const client = convexClient();

  if (operation.kind === "query") {
    const reference = makeFunctionReference<
      "query",
      JsonObject,
      unknown
    >(operation.fn);
    return await client.query(reference, args);
  }

  const reference = makeFunctionReference<
    "mutation",
    JsonObject,
    unknown
  >(operation.fn);
  return await client.mutation(reference, args);
}
