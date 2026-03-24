import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Plus, Receipt, Play, Pause, XCircle, ArrowRightLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SubscriptionsProps {
  orgId: Id<"organizations">;
}

interface Plan {
  _id: Id<"plans">;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  isActive: boolean;
}

interface Customer {
  _id: Id<"customers">;
  name: string;
  email: string;
}

interface Subscription {
  _id: Id<"subscriptions">;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  customer?: { name: string } | null;
  plan?: Plan | null;
}

export function Subscriptions({ orgId }: SubscriptionsProps) {
  const subscriptions = useQuery(api.subscriptions.list, { orgId });
  const customers = useQuery(api.customers.list, { orgId });
  const plans = useQuery(api.plans.list, { orgId });

  const createSubscription = useMutation(api.subscriptions.create);
  const pauseSubscription = useMutation(api.subscriptions.pause);
  const resumeSubscription = useMutation(api.subscriptions.resume);
  const cancelSubscription = useMutation(api.subscriptions.cancel);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    planId: "",
  });

  const activePlans = plans?.filter((p: Plan) => p.isActive) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSubscription({
      orgId,
      customerId: formData.customerId as Id<"customers">,
      planId: formData.planId as Id<"plans">,
    });
    setFormData({ customerId: "", planId: "" });
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400";
      case "paused":
        return "bg-amber-500/20 text-amber-400";
      case "cancelled":
        return "bg-zinc-500/20 text-zinc-400";
      case "past_due":
        return "bg-red-500/20 text-red-400";
      default:
        return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Subscriptions</h1>
          <p className="text-zinc-400">Manage customer subscriptions</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={!customers?.length || !activePlans.length}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Subscription</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Subscriptions List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {subscriptions?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5"
            >
              <Receipt className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No subscriptions yet</p>
              {(!customers?.length || !activePlans.length) && (
                <p className="text-sm text-zinc-500 mt-2">
                  {!customers?.length ? "Add customers first" : "Create a plan first"}
                </p>
              )}
            </motion.div>
          ) : (
            subscriptions?.map((sub: Subscription) => (
              <motion.div
                key={sub._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-white truncate">
                          {sub.customer?.name || "Unknown Customer"}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sub.status)}`}>
                          {sub.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400">
                        {sub.plan?.name || "Unknown Plan"} ·{" "}
                        {sub.plan ? formatCurrency(sub.plan.amount, sub.plan.currency) : "-"}/{sub.plan?.interval === "monthly" ? "mo" : "yr"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="text-sm text-zinc-400">
                      <span className="block sm:inline">Period: </span>
                      <span className="text-zinc-300">
                        {formatDate(sub.currentPeriodStart)} - {formatDate(sub.currentPeriodEnd)}
                      </span>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {sub.status === "active" && (
                        <button
                          onClick={() => pauseSubscription({ id: sub._id })}
                          className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                          title="Pause"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}
                      {sub.status === "paused" && (
                        <button
                          onClick={() => resumeSubscription({ id: sub._id })}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                          title="Resume"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {["active", "paused", "past_due"].includes(sub.status) && (
                        <button
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this subscription?")) {
                              cancelSubscription({ id: sub._id });
                            }
                          }}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Create Subscription Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#15151C] border border-white/10 rounded-2xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-display font-semibold text-white mb-6">New Subscription</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Customer *</label>
                  <select
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Select a customer</option>
                    {customers?.map((c: Customer) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Plan *</label>
                  <select
                    required
                    value={formData.planId}
                    onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">Select a plan</option>
                    {activePlans.map((p: Plan) => (
                      <option key={p._id} value={p._id}>
                        {p.name} - {formatCurrency(p.amount, p.currency)}/{p.interval === "monthly" ? "mo" : "yr"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-sm text-amber-300">
                    <strong>Note:</strong> An invoice will be automatically generated when the subscription is created.
                    If starting mid-cycle, the first invoice will be prorated.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                  >
                    Create Subscription
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-3 bg-white/5 text-zinc-400 rounded-xl hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
