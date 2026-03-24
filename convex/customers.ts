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
      .query("customers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const customer = await ctx.db.get(args.id);
    if (!customer) return null;

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", customer.orgId).eq("userId", userId))
      .first();

    if (!membership) return null;

    return customer;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    vatNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkOrgAccess(ctx, args.orgId, ["owner", "admin", "billing"]);

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId).eq("email", args.email))
      .first();

    if (existing) throw new Error("Customer with this email already exists");

    const customerId = await ctx.db.insert("customers", {
      ...args,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "customer.created",
      entityType: "customer",
      entityId: customerId,
      details: JSON.stringify({ name: args.name, email: args.email }),
      createdAt: Date.now(),
    });

    return customerId;
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");

    const { userId } = await checkOrgAccess(ctx, customer.orgId, ["owner", "admin", "billing"]);

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filtered);

    await ctx.db.insert("auditLogs", {
      orgId: customer.orgId,
      userId,
      action: "customer.updated",
      entityType: "customer",
      entityId: id,
      details: JSON.stringify(filtered),
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");

    const { userId } = await checkOrgAccess(ctx, customer.orgId, ["owner", "admin"]);

    // Check for active subscriptions
    const activeSubs = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("customerId", args.id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    if (activeSubs) {
      throw new Error("Cannot delete customer with active subscriptions");
    }

    await ctx.db.delete(args.id);

    await ctx.db.insert("auditLogs", {
      orgId: customer.orgId,
      userId,
      action: "customer.deleted",
      entityType: "customer",
      entityId: args.id,
      details: JSON.stringify({ name: customer.name }),
      createdAt: Date.now(),
    });
  },
});
