import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Organizations (tenants)
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    vatNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    currency: v.string(),
    webhookUrl: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  // Organization members with roles
  orgMembers: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("billing"), v.literal("viewer")),
    invitedBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  // Customers
  customers: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    email: v.string(),
    vatNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    country: v.string(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_email", ["orgId", "email"]),

  // Subscription plans
  plans: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    interval: v.union(v.literal("monthly"), v.literal("yearly")),
    vatRate: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  // Subscriptions
  subscriptions: defineTable({
    orgId: v.id("organizations"),
    customerId: v.id("customers"),
    planId: v.id("plans"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("past_due")
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_customer", ["customerId"])
    .index("by_status", ["status"]),

  // Invoices
  invoices: defineTable({
    orgId: v.id("organizations"),
    customerId: v.id("customers"),
    subscriptionId: v.optional(v.id("subscriptions")),
    invoiceNumber: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("cancelled")
    ),
    subtotal: v.number(),
    vatAmount: v.number(),
    total: v.number(),
    currency: v.string(),
    vatRate: v.number(),
    isProrated: v.boolean(),
    proratedDays: v.optional(v.number()),
    dueDate: v.number(),
    paidAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    lineItems: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPrice: v.number(),
      total: v.number(),
    })),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_customer", ["customerId"])
    .index("by_subscription", ["subscriptionId"])
    .index("by_status", ["status"])
    .index("by_org_number", ["orgId", "invoiceNumber"]),

  // Payment attempts
  paymentAttempts: defineTable({
    orgId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    amount: v.number(),
    currency: v.string(),
    status: v.union(v.literal("pending"), v.literal("succeeded"), v.literal("failed")),
    failureReason: v.optional(v.string()),
    attemptNumber: v.number(),
    nextRetryAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_org", ["orgId"]),

  // Audit logs
  auditLogs: defineTable({
    orgId: v.id("organizations"),
    userId: v.optional(v.id("users")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_time", ["orgId", "createdAt"])
    .index("by_entity", ["entityType", "entityId"]),

  // Webhook events
  webhookEvents: defineTable({
    orgId: v.id("organizations"),
    eventType: v.string(),
    payload: v.string(),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    lastAttemptAt: v.optional(v.number()),
    response: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_status", ["status"]),
});
