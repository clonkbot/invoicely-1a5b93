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

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();

    const withCustomers = await Promise.all(
      invoices.map(async (inv) => {
        const customer = await ctx.db.get(inv.customerId);
        return { ...inv, customer };
      })
    );

    return withCustomers;
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const invoice = await ctx.db.get(args.id);
    if (!invoice) return null;

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", invoice.orgId).eq("userId", userId))
      .first();

    if (!membership) return null;

    const customer = await ctx.db.get(invoice.customerId);
    const org = await ctx.db.get(invoice.orgId);

    return { ...invoice, customer, organization: org };
  },
});

export const markAsPaid = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin", "billing"]);

    await ctx.db.patch(args.id, {
      status: "paid",
      paidAt: Date.now(),
    });

    // Update subscription status if it was past_due
    if (invoice.subscriptionId) {
      const subscription = await ctx.db.get(invoice.subscriptionId);
      if (subscription?.status === "past_due") {
        await ctx.db.patch(invoice.subscriptionId, { status: "active" });
      }
    }

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: "invoice.marked_paid",
      entityType: "invoice",
      entityId: args.id,
      details: JSON.stringify({ amount: invoice.total }),
      createdAt: Date.now(),
    });

    // Create webhook event
    const org = await ctx.db.get(invoice.orgId);
    if (org?.webhookUrl) {
      await ctx.db.insert("webhookEvents", {
        orgId: invoice.orgId,
        eventType: "invoice.paid",
        payload: JSON.stringify({
          invoiceId: args.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.total,
          currency: invoice.currency,
          paidAt: Date.now(),
        }),
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });
    }
  },
});

export const sendReminder = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin", "billing"]);

    if (!["sent", "overdue"].includes(invoice.status)) {
      throw new Error("Can only send reminders for sent or overdue invoices");
    }

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: "invoice.reminder_sent",
      entityType: "invoice",
      entityId: args.id,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const cancel = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin"]);

    if (invoice.status === "paid") {
      throw new Error("Cannot cancel a paid invoice");
    }

    await ctx.db.patch(args.id, { status: "cancelled" });

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: "invoice.cancelled",
      entityType: "invoice",
      entityId: args.id,
      createdAt: Date.now(),
    });
  },
});

export const createManual = mutation({
  args: {
    orgId: v.id("organizations"),
    customerId: v.id("customers"),
    lineItems: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
    })),
    vatRate: v.number(),
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await checkOrgAccess(ctx, args.orgId, ["owner", "admin", "billing"]);

    const org = await ctx.db.get(args.orgId);
    const customer = await ctx.db.get(args.customerId);

    if (!customer || customer.orgId !== args.orgId) {
      throw new Error("Customer not found");
    }

    const lineItems = args.lineItems.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = Math.round(subtotal * (args.vatRate / 100) * 100) / 100;
    const total = subtotal + vatAmount;

    const invoiceCount = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(6, "0")}`;

    const invoiceId = await ctx.db.insert("invoices", {
      orgId: args.orgId,
      customerId: args.customerId,
      invoiceNumber,
      status: "draft",
      subtotal,
      vatAmount,
      total,
      currency: org?.currency || "USD",
      vatRate: args.vatRate,
      isProrated: false,
      dueDate: args.dueDate,
      lineItems,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "invoice.created",
      entityType: "invoice",
      entityId: invoiceId,
      details: JSON.stringify({ total, customerId: args.customerId }),
      createdAt: Date.now(),
    });

    return invoiceId;
  },
});

export const send = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.id);
    if (!invoice) throw new Error("Invoice not found");

    const { userId } = await checkOrgAccess(ctx, invoice.orgId, ["owner", "admin", "billing"]);

    if (invoice.status !== "draft") {
      throw new Error("Can only send draft invoices");
    }

    await ctx.db.patch(args.id, {
      status: "sent",
      sentAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: invoice.orgId,
      userId,
      action: "invoice.sent",
      entityType: "invoice",
      entityId: args.id,
      createdAt: Date.now(),
    });

    // Create webhook event
    const org = await ctx.db.get(invoice.orgId);
    if (org?.webhookUrl) {
      await ctx.db.insert("webhookEvents", {
        orgId: invoice.orgId,
        eventType: "invoice.sent",
        payload: JSON.stringify({
          invoiceId: args.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.total,
          currency: invoice.currency,
        }),
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
      });
    }
  },
});
