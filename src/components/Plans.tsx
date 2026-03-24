import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Plus, CreditCard, Check, X, Percent } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PlansProps {
  orgId: Id<"organizations">;
}

interface Plan {
  _id: Id<"plans">;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: "monthly" | "yearly";
  vatRate: number;
  isActive: boolean;
}

export function Plans({ orgId }: PlansProps) {
  const plans = useQuery(api.plans.list, { orgId });
  const createPlan = useMutation(api.plans.create);
  const updatePlan = useMutation(api.plans.update);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: "",
    currency: "USD",
    interval: "monthly" as "monthly" | "yearly",
    vatRate: "20",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createPlan({
      orgId,
      name: formData.name,
      description: formData.description || undefined,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      interval: formData.interval,
      vatRate: parseFloat(formData.vatRate),
    });
    setFormData({
      name: "",
      description: "",
      amount: "",
      currency: "USD",
      interval: "monthly",
      vatRate: "20",
    });
    setShowForm(false);
  };

  const toggleActive = async (planId: Id<"plans">, isActive: boolean) => {
    await updatePlan({ id: planId, isActive: !isActive });
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
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Plans</h1>
          <p className="text-zinc-400">Configure subscription pricing plans</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Create Plan</span>
          <span className="sm:hidden">Create</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {plans?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="md:col-span-2 lg:col-span-3 text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5"
            >
              <CreditCard className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No plans created yet</p>
            </motion.div>
          ) : (
            plans?.map((plan: Plan, index: number) => (
              <motion.div
                key={plan._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative bg-white/[0.03] backdrop-blur-sm border rounded-2xl p-5 md:p-6 transition-all ${
                  plan.isActive ? "border-amber-500/30" : "border-white/10 opacity-60"
                }`}
              >
                {!plan.isActive && (
                  <div className="absolute top-4 right-4 px-2 py-1 bg-zinc-600/50 rounded text-xs text-zinc-300">
                    Inactive
                  </div>
                )}

                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-6 h-6 text-amber-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-white truncate">{plan.name}</h3>
                    <p className="text-sm text-zinc-400 truncate">{plan.description || "No description"}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-display font-semibold text-white">
                    {formatCurrency(plan.amount, plan.currency)}
                  </span>
                  <span className="text-zinc-400">/{plan.interval === "monthly" ? "mo" : "yr"}</span>
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Percent className="w-4 h-4" />
                    <span>{plan.vatRate}% VAT</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Recurring billing</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Proration support</span>
                  </div>
                </div>

                <button
                  onClick={() => toggleActive(plan._id, plan.isActive)}
                  className={`w-full py-2.5 rounded-xl font-medium transition-all ${
                    plan.isActive
                      ? "bg-white/5 text-zinc-400 hover:bg-white/10"
                      : "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                  }`}
                >
                  {plan.isActive ? "Deactivate" : "Activate"}
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Create Plan Modal */}
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
              className="w-full max-w-md bg-[#15151C] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-display font-semibold text-white mb-6">Create Plan</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Pro Plan"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Amount *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="99.00"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">Billing Interval</label>
                    <select
                      value={formData.interval}
                      onChange={(e) =>
                        setFormData({ ...formData, interval: e.target.value as "monthly" | "yearly" })
                      }
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-300 mb-2">VAT Rate (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.vatRate}
                      onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                  >
                    Create Plan
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
