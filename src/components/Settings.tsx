import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Settings as SettingsIcon,
  Building2,
  Webhook,
  Users,
  Crown,
  Shield,
  Eye,
  Receipt,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SettingsProps {
  orgId: Id<"organizations">;
}

interface Member {
  _id: Id<"orgMembers">;
  role: string;
  createdAt: number;
  user?: { email?: string } | null;
}

interface WebhookEvent {
  _id: Id<"webhookEvents">;
  eventType: string;
  status: string;
  attempts: number;
  lastAttemptAt?: number;
}

export function Settings({ orgId }: SettingsProps) {
  const org = useQuery(api.organizations.get, { id: orgId });
  const members = useQuery(api.organizations.getMembers, { orgId });
  const webhooks = useQuery(api.webhooks.list, { orgId });

  const updateOrg = useMutation(api.organizations.update);
  const retryWebhook = useMutation(api.webhooks.retry);

  const [activeTab, setActiveTab] = useState<"general" | "team" | "webhooks">("general");
  const [formData, setFormData] = useState({
    name: "",
    vatNumber: "",
    address: "",
    webhookUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize form when org loads
  if (org && !formData.name && !saving) {
    setFormData({
      name: org.name || "",
      vatNumber: org.vatNumber || "",
      address: org.address || "",
      webhookUrl: org.webhookUrl || "",
    });
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOrg({
        id: orgId,
        name: formData.name,
        vatNumber: formData.vatNumber || undefined,
        address: formData.address || undefined,
        webhookUrl: formData.webhookUrl || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-amber-400" />;
      case "admin":
        return <Shield className="w-4 h-4 text-purple-400" />;
      case "billing":
        return <Receipt className="w-4 h-4 text-blue-400" />;
      default:
        return <Eye className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getWebhookStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "team", label: "Team", icon: Users },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Settings</h1>
        <p className="text-zinc-400">Manage organization settings and team</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-amber-500 text-black"
                  : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "general" && (
          <motion.div
            key="general"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6"
          >
            <h2 className="text-lg font-display font-semibold text-white mb-6">Organization Details</h2>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">VAT Number</label>
                <input
                  type="text"
                  value={formData.vatNumber}
                  onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                  placeholder="e.g., GB123456789"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">Business Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  placeholder="Your business address"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-2">Webhook URL</label>
                <input
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                  placeholder="https://your-domain.com/webhook"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  We'll send events for invoice.sent, invoice.paid, payment.succeeded, and payment.failed
                </p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "team" && (
          <motion.div
            key="team"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6"
          >
            <h2 className="text-lg font-display font-semibold text-white mb-6">Team Members</h2>

            <div className="space-y-4">
              {members?.map((member: Member) => (
                <div
                  key={member._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-amber-500">
                        {member.user?.email?.charAt(0).toUpperCase() || "?"}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium truncate max-w-[200px] sm:max-w-none">
                        {member.user?.email || "Unknown"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Added {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-13 sm:ml-0">
                    {getRoleIcon(member.role)}
                    <span className="text-sm text-zinc-300 capitalize">{member.role}</span>
                  </div>
                </div>
              ))}

              {(!members || members.length === 0) && (
                <p className="text-zinc-500 text-center py-8">No team members</p>
              )}
            </div>

            <div className="mt-6 p-4 bg-white/5 rounded-xl">
              <h3 className="text-sm font-medium text-white mb-2">Role Permissions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span><strong>Owner:</strong> Full access</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-purple-400" />
                  <span><strong>Admin:</strong> Manage settings, plans</span>
                </div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-3 h-3 text-blue-400" />
                  <span><strong>Billing:</strong> Manage customers, invoices</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-3 h-3 text-zinc-400" />
                  <span><strong>Viewer:</strong> Read-only access</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "webhooks" && (
          <motion.div
            key="webhooks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6"
          >
            <h2 className="text-lg font-display font-semibold text-white mb-6">Webhook Events</h2>

            {!org?.webhookUrl ? (
              <div className="text-center py-8">
                <Webhook className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 mb-2">No webhook URL configured</p>
                <p className="text-sm text-zinc-500">
                  Add a webhook URL in General settings to receive events
                </p>
              </div>
            ) : webhooks?.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No webhook events yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks?.map((event: WebhookEvent) => (
                  <div
                    key={event._id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white/5 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getWebhookStatusIcon(event.status)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{event.eventType}</p>
                        <p className="text-xs text-zinc-500 truncate">
                          Attempts: {event.attempts} ·{" "}
                          {event.lastAttemptAt
                            ? new Date(event.lastAttemptAt).toLocaleString()
                            : "Pending"}
                        </p>
                      </div>
                    </div>

                    {event.status === "failed" && (
                      <button
                        onClick={() => retryWebhook({ id: event._id })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
