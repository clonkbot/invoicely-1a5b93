import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const memberships = await ctx.db
      .query("orgMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await ctx.db.get(m.orgId);
        return org ? { ...org, role: m.role } : null;
      })
    );

    return orgs.filter(Boolean);
  },
});

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.id).eq("userId", userId))
      .first();

    if (!membership) return null;

    const org = await ctx.db.get(args.id);
    return org ? { ...org, role: membership.role } : null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const slug = args.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const orgId = await ctx.db.insert("organizations", {
      name: args.name,
      slug,
      currency: args.currency || "USD",
      createdAt: Date.now(),
    });

    await ctx.db.insert("orgMembers", {
      orgId,
      userId,
      role: "owner",
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId,
      userId,
      action: "organization.created",
      entityType: "organization",
      entityId: orgId,
      details: JSON.stringify({ name: args.name }),
      createdAt: Date.now(),
    });

    return orgId;
  },
});

export const update = mutation({
  args: {
    id: v.id("organizations"),
    name: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    address: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.id).eq("userId", userId))
      .first();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized");
    }

    const { id, ...updates } = args;
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, filtered);

    await ctx.db.insert("auditLogs", {
      orgId: id,
      userId,
      action: "organization.updated",
      entityType: "organization",
      entityId: id,
      details: JSON.stringify(filtered),
      createdAt: Date.now(),
    });
  },
});

export const getMembers = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership) return [];

    const members = await ctx.db
      .query("orgMembers")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    const withUsers = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return { ...m, user };
      })
    );

    return withUsers;
  },
});

export const addMember = mutation({
  args: {
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("billing"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", currentUserId))
      .first();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Not authorized");
    }

    const existing = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", args.userId))
      .first();

    if (existing) throw new Error("User is already a member");

    await ctx.db.insert("orgMembers", {
      orgId: args.orgId,
      userId: args.userId,
      role: args.role,
      invitedBy: currentUserId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId: currentUserId,
      action: "member.added",
      entityType: "member",
      entityId: args.userId,
      details: JSON.stringify({ role: args.role }),
      createdAt: Date.now(),
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    orgId: v.id("organizations"),
    memberId: v.id("orgMembers"),
    role: v.union(v.literal("admin"), v.literal("billing"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const membership = await ctx.db
      .query("orgMembers")
      .withIndex("by_org_user", (q) => q.eq("orgId", args.orgId).eq("userId", userId))
      .first();

    if (!membership || membership.role !== "owner") {
      throw new Error("Only owners can change roles");
    }

    const target = await ctx.db.get(args.memberId);
    if (!target || target.orgId !== args.orgId) throw new Error("Member not found");
    if (target.role === "owner") throw new Error("Cannot change owner role");

    await ctx.db.patch(args.memberId, { role: args.role });

    await ctx.db.insert("auditLogs", {
      orgId: args.orgId,
      userId,
      action: "member.role_changed",
      entityType: "member",
      entityId: args.memberId,
      details: JSON.stringify({ newRole: args.role }),
      createdAt: Date.now(),
    });
  },
});
