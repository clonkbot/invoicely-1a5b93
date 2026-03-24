import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

async function checkOrgAccess(ctx: any, orgId: any, minRole?: string[]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const membership = await ctx.db
    .query("orgMembers")
    .withIndex("by_org_user", (q: any) => q.eq("orgId", orgId).eq("userId", userId))
    .first();

  if (!membership) throw new Error("Not a member of this organization");

  if (minRole && !minRole.includes(membership.role)) {
    throw new Error("Insufficient permissions");
  }

  return { userId, membership };
}

export const list = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    return await ctx.db
      .query("plans")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    interval: v.union(v.literal("monthly"), v.literal("yearly")),
    vatRate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkOrgAccess(ctx, args.orgId, ["owner", "admin"]);

    const planId = await ctx.db.insert("plans", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "plan.created",
      entityType: "plan",
      entityId: planId,
      details: JSON.stringify({ name: args.name, amount: args.amount }),
      createdAt: Date.now(),
    });

    return planId;
  },
});

export const update = mutation({
  args: {
    id: v.id("plans"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    amount: v.optional(v.number()),
    vatRate: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.id);
    if (!plan) throw new Error("Plan not found");

    const { userId } = await checkOrgAccess(ctx, plan.orgId, ["owner", "admin"]);

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filtered);

    await ctx.db.insert("auditLogs", {
      orgId: plan.orgId,
      userId,
      action: "plan.updated",
      entityType: "plan",
      entityId: id,
      details: JSON.stringify(filtered),
      createdAt: Date.now(),
    });
  },
});
