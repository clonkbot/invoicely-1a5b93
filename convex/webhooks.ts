import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
      .query("webhookEvents")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(50);
  },
});

export const retry = mutation({
  args: { id: v.id("webhookEvents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Webhook event not found");

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", event.orgId).eq("userId", userId))
      .first();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized");
    }

    // Simulate webhook delivery (in real app, would actually call the URL)
    const success = Math.random() > 0.2;

    await ctx.db.patch(args.id, {
      status: success ? "sent" : "failed",
      attempts: event.attempts + 1,
      lastAttemptAt: Date.now(),
      response: success ? "200 OK" : "Connection refused",
    });

    await ctx.db.insert("auditLogs", {
      orgId: event.orgId,
      userId,
      action: "webhook.retried",
      entityType: "webhook",
      entityId: args.id,
      details: JSON.stringify({ success, attempts: event.attempts + 1 }),
      createdAt: Date.now(),
    });

    return { success };
  },
});
