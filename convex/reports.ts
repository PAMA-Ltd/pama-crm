import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireOrganizationMember } from "./authz";
import { dealStageValidator } from "./crmModels";

const OPEN_STAGES = ["Lead", "Qualified", "Proposal", "Negotiation"] as const;

export const forecast = query({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    openPipeline: v.number(),
    weightedForecast: v.number(),
    wonRevenue: v.number(),
    winRate: v.number(),
    openCount: v.number(),
    wonCount: v.number(),
    stages: v.array(
      v.object({
        stage: dealStageValidator,
        count: v.number(),
        total: v.number(),
        weighted: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const deals = await ctx.db
      .query("deals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(500);

    const isOpen = (stage: string) =>
      (OPEN_STAGES as readonly string[]).includes(stage);
    const open = deals.filter((deal) => isOpen(deal.stage));
    const won = deals.filter((deal) => deal.stage === "Won");
    const lost = deals.filter((deal) => deal.stage === "Lost");
    const openPipeline = open.reduce((sum, deal) => sum + deal.amount, 0);
    const weightedForecast = open.reduce(
      (sum, deal) => sum + (deal.amount * deal.probability) / 100,
      0,
    );
    const wonRevenue = won.reduce((sum, deal) => sum + deal.amount, 0);
    const closed = won.length + lost.length;

    const stages = [
      "Lead",
      "Qualified",
      "Proposal",
      "Negotiation",
      "Won",
      "Lost",
    ] as const;

    return {
      openPipeline,
      weightedForecast: Math.round(weightedForecast),
      wonRevenue,
      winRate: closed ? Math.round((won.length / closed) * 100) : 0,
      openCount: open.length,
      wonCount: won.length,
      stages: stages.map((stage) => {
        const rows = deals.filter((deal) => deal.stage === stage);
        return {
          stage,
          count: rows.length,
          total: rows.reduce((sum, deal) => sum + deal.amount, 0),
          weighted: Math.round(
            rows.reduce(
              (sum, deal) => sum + (deal.amount * deal.probability) / 100,
              0,
            ),
          ),
        };
      }),
    };
  },
});

export const slippingDeals = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("deals"),
      name: v.string(),
      companyId: v.id("companies"),
      amount: v.number(),
      stage: dealStageValidator,
      expectedCloseDate: v.optional(v.string()),
      daysLate: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const rows = await ctx.db
      .query("deals")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(500);

    return rows
      .filter(
        (deal) =>
          deal.stage !== "Won" &&
          deal.stage !== "Lost" &&
          deal.expectedCloseDate &&
          deal.expectedCloseDate < todayIso,
      )
      .map((deal) => ({
        _id: deal._id,
        name: deal.name,
        companyId: deal.companyId,
        amount: deal.amount,
        stage: deal.stage,
        expectedCloseDate: deal.expectedCloseDate,
        daysLate: Math.max(
          1,
          Math.floor(
            (Date.now() - Date.parse(`${deal.expectedCloseDate}T00:00:00Z`)) /
              (24 * 60 * 60 * 1000),
          ),
        ),
      }))
      .sort((a, b) => b.daysLate - a.daysLate)
      .slice(0, Math.min(args.limit ?? 100, 250));
  },
});

export const notifications = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      kind: v.string(),
      createdAt: v.number(),
      overdue: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const activities = await ctx.db
      .query("activities")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(Math.min(args.limit ?? 30, 100));

    const now = Date.now();
    return activities.map((activity) => ({
      id: activity._id,
      title: activity.subject,
      description: activity.description,
      kind: activity.type,
      createdAt: activity._creationTime,
      overdue:
        Boolean(activity.dueAt) &&
        !activity.completedAt &&
        (activity.dueAt ?? now) < now,
    }));
  },
});

export const companyInsights = query({
  args: {
    organizationId: v.id("organizations"),
    companyId: v.id("companies"),
    days: v.optional(v.number()),
  },
  returns: v.object({
    activityTrend: v.array(v.number()),
    scoreCards: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        verdict: v.string(),
        score: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOrganizationMember(ctx, args.organizationId);
    const company = await ctx.db.get(args.companyId);
    if (!company || company.organizationId !== args.organizationId) {
      throw new Error("Company not found.");
    }

    const [activities, deals, contacts] = await Promise.all([
      ctx.db
        .query("activities")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .take(500),
      ctx.db
        .query("deals")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .take(500),
      ctx.db
        .query("contacts")
        .withIndex("by_organization_and_company", (q) =>
          q
            .eq("organizationId", args.organizationId)
            .eq("companyId", args.companyId),
        )
        .take(500),
    ]);

    const today = new Date();
    const days = Math.min(90, Math.max(7, Math.round(args.days ?? 30)));
    const trend = Array.from({ length: days }, (_, index) => {
      const day = new Date(today);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (days - 1 - index));
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return activities.filter(
        (activity) =>
          activity._creationTime >= day.getTime() &&
          activity._creationTime < next.getTime(),
      ).length;
    });

    const open = deals.filter(
      (deal) => deal.stage !== "Won" && deal.stage !== "Lost",
    );
    const weighted =
      open.length > 0
        ? Math.round(
            open.reduce((sum, deal) => sum + deal.probability, 0) / open.length,
          )
        : 0;
    const recentActivities = activities.filter(
      (activity) =>
        activity._creationTime >= Date.now() - days * 24 * 60 * 60 * 1000,
    ).length;

    const engagementScore = Math.min(100, recentActivities * 12 + contacts.length * 8);
    const businessFitScore = Math.min(
      100,
      40 + company.tags.length * 10 + Math.min(30, contacts.length * 5),
    );

    return {
      activityTrend: trend,
      scoreCards: [
        {
          title: "Business fit",
          description: "Derived from segment depth and known stakeholder coverage.",
          verdict:
            businessFitScore >= 70
              ? "Strong fit"
              : businessFitScore >= 45
                ? "Moderate fit"
                : "Needs qualification",
          score: businessFitScore,
        },
        {
          title: "Engagement",
          description: "Derived from recent CRM activity and contact coverage.",
          verdict:
            engagementScore >= 70
              ? "Highly engaged"
              : engagementScore >= 40
                ? "Engaged"
                : "Needs attention",
          score: engagementScore,
        },
        {
          title: "Deal health",
          description: "Derived from the current weighted probability of open deals.",
          verdict:
            weighted >= 70
              ? "Healthy"
              : weighted >= 40
                ? "Developing"
                : "At risk",
          score: weighted,
        },
      ],
    };
  },
});
