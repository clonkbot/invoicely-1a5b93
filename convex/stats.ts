import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getDashboard = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership) return null;

    // Get all data in parallel
    const [customers, subscriptions, invoices, plans] = await Promise.all([
      ctx.db.query("customers").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("invoices").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("plans").withIndex("by_org", (q) => q.eq("orgId", args.orgId)).collect(),
    ]);

    const activeSubscriptions = subscriptions.filter((s) => s.status === "active");
    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");

    // Calculate MRR
    const mrr = await Promise.all(
      activeSubscriptions.map(async (sub) => {
        const plan = plans.find((p) => p._id === sub.planId);
        if (!plan) return 0;
        return plan.interval === "monthly" ? plan.amount : plan.amount / 12;
      })
    );
    const totalMRR = mrr.reduce((sum, val) => sum + val, 0);

    // Revenue this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenueThisMonth = paidInvoices
      .filter((i) => i.paidAt && i.paidAt >= startOfMonth.getTime())
      .reduce((sum, i) => sum + i.total, 0);

    // Outstanding amount
    const outstandingAmount = invoices
      .filter((i) => ["sent", "overdue"].includes(i.status))
      .reduce((sum, i) => sum + i.total, 0);

    return {
      totalCustomers: customers.length,
      activeSubscriptions: activeSubscriptions.length,
      totalInvoices: invoices.length,
      paidInvoices: paidInvoices.length,
      overdueInvoices: overdueInvoices.length,
      mrr: totalMRR,
      revenueThisMonth,
      outstandingAmount,
    };
  },
});
