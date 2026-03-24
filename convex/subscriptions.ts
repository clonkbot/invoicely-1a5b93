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

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const withDetails = await Promise.all(
      subscriptions.map(async (sub) => {
        const customer = await ctx.db.get(sub.customerId);
        const plan = await ctx.db.get(sub.planId);
        return { ...sub, customer, plan };
      })
    );

    return withDetails;
  },
});

export const listByCustomer = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const customer = await ctx.db.get(args.customerId);
    if (!customer) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", customer.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("customerId", args.customerId))
      .collect();

    const withPlans = await Promise.all(
      subscriptions.map(async (sub) => {
        const plan = await ctx.db.get(sub.planId);
        return { ...sub, plan };
      })
    );

    return withPlans;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    customerId: v.id("customers"),
    planId: v.id("plans"),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkOrgAccess(ctx, args.orgId, ["owner", "admin", "billing"]);

    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.orgId !== args.orgId) throw new Error("Plan not found");

    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.orgId !== args.orgId) throw new Error("Customer not found");

    const now = args.startDate || Date.now();
    const periodEnd = plan.interval === "monthly"
      ? now + 30 * 24 * 60 * 60 * 1000
      : now + 365 * 24 * 60 * 60 * 1000;

    const subscriptionId = await ctx.db.insert("subscriptions", {
      orgId: args.orgId,
      customerId: args.customerId,
      planId: args.planId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      createdAt: Date.now(),
    });

    // Calculate proration if starting mid-cycle
    const daysInPeriod = plan.interval === "monthly" ? 30 : 365;
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const daysPassed = Math.floor((now - startOfMonth.getTime()) / (24 * 60 * 60 * 1000));
    const isProrated = daysPassed > 0;
    const proratedDays = isProrated ? daysInPeriod - daysPassed : daysInPeriod;
    const proratedAmount = isProrated
      ? Math.round((plan.amount / daysInPeriod) * proratedDays * 100) / 100
      : plan.amount;

    const vatAmount = Math.round(proratedAmount * (plan.vatRate / 100) * 100) / 100;
    const total = proratedAmount + vatAmount;

    // Generate invoice number
    const invoiceCount = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(6, "0")}`;

    // Create initial invoice
    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      customerId: args.customerId,
      subscriptionId,
      invoiceNumber,
      status: "sent",
      subtotal: proratedAmount,
      vatAmount,
      total,
      currency: plan.currency,
      vatRate: plan.vatRate,
      isProrated,
      proratedDays: isProrated ? proratedDays : undefined,
      dueDate: now + 14 * 24 * 60 * 60 * 1000,
      sentAt: Date.now(),
      lineItems: [{
        description: `${plan.name} subscription${isProrated ? ` (prorated ${proratedDays} days)` : ""}`,
        quantity: 1,
        unitPrice: proratedAmount,
        total: proratedAmount,
      }],
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "subscription.created",
      entityType: "subscription",
      entityId: subscriptionId,
      details: JSON.stringify({ customerId: args.customerId, planId: args.planId, invoiceId }),
      createdAt: Date.now(),
    });

    return subscriptionId;
  },
});

export const cancel = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.id);
    if (!subscription) throw new Error("Subscription not found");

    const { userId } = await checkOrgAccess(ctx, subscription.orgId, ["owner", "admin", "billing"]);

    await ctx.db.patch(args.id, {
      status: "cancelled",
      cancelledAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: subscription.orgId,
      userId,
      action: "subscription.cancelled",
      entityType: "subscription",
      entityId: args.id,
      createdAt: Date.now(),
    });
  },
});

export const pause = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.id);
    if (!subscription) throw new Error("Subscription not found");

    const { userId } = await checkOrgAccess(ctx, subscription.orgId, ["owner", "admin", "billing"]);

    if (subscription.status !== "active") {
      throw new Error("Can only pause active subscriptions");
    }

    await ctx.db.patch(args.id, { status: "paused" });

    await ctx.db.insert("auditLogs", {
      orgId: subscription.orgId,
      userId,
      action: "subscription.paused",
      entityType: "subscription",
      entityId: args.id,
      createdAt: Date.now(),
    });
  },
});

export const resume = mutation({
  args: { id: v.id("subscriptions") },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.id);
    if (!subscription) throw new Error("Subscription not found");

    const { userId } = await checkOrgAccess(ctx, subscription.orgId, ["owner", "admin", "billing"]);

    if (subscription.status !== "paused") {
      throw new Error("Can only resume paused subscriptions");
    }

    await ctx.db.patch(args.id, { status: "active" });

    await ctx.db.insert("auditLogs", {
      orgId: subscription.orgId,
      userId,
      action: "subscription.resumed",
      entityType: "subscription",
      entityId: args.id,
      createdAt: Date.now(),
    });
  },
});

export const changePlan = mutation({
  args: {
    id: v.id("subscriptions"),
    newPlanId: v.id("plans"),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.id);
    if (!subscription) throw new Error("Subscription not found");

    const { userId } = await checkOrgAccess(ctx, subscription.orgId, ["owner", "admin", "billing"]);

    const oldPlan = await ctx.db.get(subscription.planId);
    const newPlan = await ctx.db.get(args.newPlanId);

    if (!newPlan || newPlan.orgId !== subscription.orgId) {
      throw new Error("New plan not found");
    }

    // Calculate prorated credit/charge
    const now = Date.now();
    const remainingDays = Math.max(0, Math.floor((subscription.currentPeriodEnd - now) / (24 * 60 * 60 * 1000)));
    const daysInPeriod = oldPlan?.interval === "monthly" ? 30 : 365;

    const oldDailyRate = (oldPlan?.amount || 0) / daysInPeriod;
    const newDailyRate = newPlan.amount / (newPlan.interval === "monthly" ? 30 : 365);

    const credit = oldDailyRate * remainingDays;
    const charge = newDailyRate * remainingDays;
    const adjustment = Math.round((charge - credit) * 100) / 100;

    await ctx.db.patch(args.id, {
      planId: args.newPlanId,
    });

    if (adjustment !== 0) {
      const invoiceCount = await ctx.db
        .query("invoices")
        .withIndex("by_org", (q) => q.eq("orgId", subscription.orgId))
        .collect();
      const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(6, "0")}`;

      const vatAmount = Math.round(Math.abs(adjustment) * (newPlan.vatRate / 100) * 100) / 100;

      await ctx.db.insert("invoices", {
        orgId: subscription.orgId,
        customerId: subscription.customerId,
        subscriptionId: args.id,
        invoiceNumber,
        status: adjustment > 0 ? "sent" : "paid",
        subtotal: adjustment,
        vatAmount: adjustment > 0 ? vatAmount : -vatAmount,
        total: adjustment > 0 ? adjustment + vatAmount : adjustment - vatAmount,
        currency: newPlan.currency,
        vatRate: newPlan.vatRate,
        isProrated: true,
        proratedDays: remainingDays,
        dueDate: now + 14 * 24 * 60 * 60 * 1000,
        sentAt: Date.now(),
        lineItems: [{
          description: `Plan change: ${oldPlan?.name || "Unknown"} → ${newPlan.name} (prorated ${remainingDays} days)`,
          quantity: 1,
          unitPrice: adjustment,
          total: adjustment,
        }],
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("auditLogs", {
      orgId: subscription.orgId,
      userId,
      action: "subscription.plan_changed",
      entityType: "subscription",
      entityId: args.id,
      details: JSON.stringify({
        oldPlanId: subscription.planId,
        newPlanId: args.newPlanId,
        adjustment,
      }),
      createdAt: Date.now(),
    });
  },
});
