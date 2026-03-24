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

export const listByInvoice = query({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", invoice.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    return await ctx.db
      .query("paymentAttempts")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .collect();
  },
});

export const listFailed = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    const failedAttempts = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .filter((q) => q.eq(q.field("status"), "failed"))
      .order("desc")
      .collect();

    const withInvoices = await Promise.all(
      failedAttempts.map(async (attempt) => {
        const invoice = await ctx.db.get(attempt.invoiceId);
        const customer = invoice ? await ctx.db.get(invoice.customerId) : null;
        return { ...attempt, invoice, customer };
      })
    );

    return withInvoices;
  },
});

export const recordAttempt = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin", "billing"]);

    // Get previous attempts count
    const previousAttempts = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();

    const attemptNumber = previousAttempts.length + 1;

    // Calculate next retry (exponential backoff: 1 day, 3 days, 7 days)
    const retryDelays = [1, 3, 7];
    const nextRetryDays = args.status === "failed" && attemptNumber <= 3
      ? retryDelays[attemptNumber - 1]
      : undefined;

    await ctx.db.insert("paymentAttempts", {
      orgId: invoice.orgId,
      invoiceId: args.invoiceId,
      amount: invoice.total,
      currency: invoice.currency,
      status: args.status,
      failureReason: args.failureReason,
      attemptNumber,
      nextRetryAt: nextRetryDays
        ? Date.now() + nextRetryDays * 24 * 60 * 60 * 1000
        : undefined,
      createdAt: Date.now(),
    });

    // Update invoice status
    if (args.status === "succeeded") {
      await ctx.db.patch(args.invoiceId, {
        status: "paid",
        paidAt: Date.now(),
      });

      // Update subscription status if past_due
      if (invoice.subscriptionId) {
        const subscription = await ctx.db.get(invoice.subscriptionId);
        if (subscription?.status === "past_due") {
          await ctx.db.patch(invoice.subscriptionId, { status: "active" });
        }
      }
    } else if (args.status === "failed") {
      await ctx.db.patch(args.invoiceId, { status: "overdue" });

      // Mark subscription as past_due after 3 failed attempts
      if (attemptNumber >= 3 && invoice.subscriptionId) {
        await ctx.db.patch(invoice.subscriptionId, { status: "past_due" });
      }
    }

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: args.status === "succeeded" ? "payment.succeeded" : "payment.failed",
      entityType: "payment",
      entityId: args.invoiceId,
      details: JSON.stringify({
        attemptNumber,
        amount: invoice.total,
        failureReason: args.failureReason,
      }),
      createdAt: Date.now(),
    });

    // Create webhook event
    const org = await ctx.db.get(invoice.orgId);
    if (org?.webhookUrl) {
      await ctx.db.insert("webhookEvents", {
        orgId: invoice.orgId,
        eventType: args.status === "succeeded" ? "payment.succeeded" : "payment.failed",
        payload: JSON.stringify({
          invoiceId: args.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.total,
          attemptNumber,
          failureReason: args.failureReason,
        }),
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });
    }
  },
});

export const retryPayment = mutation({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin", "billing"]);

    if (!["sent", "overdue"].includes(invoice.status)) {
      throw new Error("Cannot retry payment for this invoice");
    }

    // Simulate payment attempt (in real app, would call payment provider)
    const success = Math.random() > 0.3; // 70% success rate for demo

    const previousAttempts = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();

    const attemptNumber = previousAttempts.length + 1;

    await ctx.db.insert("paymentAttempts", {
      orgId: invoice.orgId,
      invoiceId: args.invoiceId,
      amount: invoice.total,
      currency: invoice.currency,
      status: success ? "succeeded" : "failed",
      failureReason: success ? undefined : "Card declined",
      attemptNumber,
      nextRetryAt: !success && attemptNumber < 3
        ? Date.now() + (attemptNumber === 1 ? 1 : attemptNumber === 2 ? 3 : 7) * 24 * 60 * 60 * 1000
        : undefined,
      createdAt: Date.now(),
    });

    if (success) {
      await ctx.db.patch(args.invoiceId, {
        status: "paid",
        paidAt: Date.now(),
      });

      if (invoice.subscriptionId) {
        const subscription = await ctx.db.get(invoice.subscriptionId);
        if (subscription?.status === "past_due") {
          await ctx.db.patch(invoice.subscriptionId, { status: "active" });
        }
      }
    } else {
      await ctx.db.patch(args.invoiceId, { status: "overdue" });

      if (attemptNumber >= 3 && invoice.subscriptionId) {
        await ctx.db.patch(invoice.subscriptionId, { status: "past_due" });
      }
    }

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: success ? "payment.succeeded" : "payment.failed",
      entityType: "payment",
      entityId: args.invoiceId,
      details: JSON.stringify({ attemptNumber, manual: true }),
      createdAt: Date.now(),
    });

    return { success };
  },
});
