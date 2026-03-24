import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    orgId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .take(args.limit || 100);

    const withUsers = await Promise.all(
      logs.map(async (log) => {
        const user = log.userId ? await ctx.db.get(log.userId) : null;
        return { ...log, user };
      })
    );

    return withUsers;
  },
});

export const listByEntity = query({
  args: {
    entityType: v.string(),
    entityId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        q.eq("entityType", args.entityType).eq("entityId", args.entityId)
      )
      .order("desc")
      .collect();

    if (logs.length === 0) return [];

    // Check membership for the first log's org
    const firstLog = logs[0];
    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", firstLog.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    const withUsers = await Promise.all(
      logs.map(async (log) => {
        const user = log.userId ? await ctx.db.get(log.userId) : null;
        return { ...log, user };
      })
    );

    return withUsers;
  },
});
