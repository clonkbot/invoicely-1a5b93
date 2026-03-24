import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  Users,
  Receipt,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";

interface DashboardProps {
  orgId: Id<"organizations">;
}

interface Invoice {
  _id: Id<"invoices">;
  invoiceNumber: string;
  status: string;
  total: number;
  customer?: { name: string } | null;
}

interface LogEntry {
  _id: Id<"auditLogs">;
  action: string;
  createdAt: number;
}

export function Dashboard({ orgId }: DashboardProps) {
  const stats = useQuery(api.stats.getDashboard, { orgId });
  const invoices = useQuery(api.invoices.list, { orgId });
  const auditLogs = useQuery(api.auditLogs.list, { orgId, limit: 5 });

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const statCards = [
    {
      label: "Monthly Recurring",
      value: formatCurrency(stats.mrr),
      icon: TrendingUp,
      color: "from-emerald-500 to-teal-600",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Revenue This Month",
      value: formatCurrency(stats.revenueThisMonth),
      icon: DollarSign,
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Active Subscriptions",
      value: stats.activeSubscriptions.toString(),
      icon: Receipt,
      color: "from-blue-500 to-indigo-600",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total Customers",
      value: stats.totalCustomers.toString(),
      icon: Users,
      color: "from-purple-500 to-pink-600",
      bgColor: "bg-purple-500/10",
    },
  ];

  const recentInvoices = invoices?.slice(0, 5) || [];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Dashboard</h1>
        <p className="text-zinc-400">Overview of your billing metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xl md:text-2xl font-display font-semibold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-zinc-400">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Alert Cards */}
      {(stats.overdueInvoices > 0 || stats.outstandingAmount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.overdueInvoices > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4"
            >
              <div className="p-3 bg-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {stats.overdueInvoices} Overdue Invoice{stats.overdueInvoices !== 1 ? "s" : ""}
                </p>
                <p className="text-sm text-red-300/70">Requires immediate attention</p>
              </div>
            </motion.div>
          )}

          {stats.outstandingAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4"
            >
              <div className="p-3 bg-amber-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(stats.outstandingAmount)} Outstanding
                </p>
                <p className="text-sm text-amber-300/70">Pending payments</p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Recent Invoices */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Recent Invoices</h2>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4 text-center">No invoices yet</p>
            ) : (
              recentInvoices.map((invoice: Invoice) => (
                <div
                  key={invoice._id}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2 rounded-lg ${
                        invoice.status === "paid"
                          ? "bg-emerald-500/10"
                          : invoice.status === "overdue"
                          ? "bg-red-500/10"
                          : "bg-amber-500/10"
                      }`}
                    >
                      {invoice.status === "paid" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : invoice.status === "overdue" ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-zinc-500 truncate">{invoice.customer?.name || "Unknown"}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-white ml-2">{formatCurrency(invoice.total)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 md:p-6">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {!auditLogs || auditLogs.length === 0 ? (
              <p className="text-zinc-500 text-sm py-4 text-center">No activity yet</p>
            ) : (
              auditLogs.map((log: LogEntry) => (
                <div
                  key={log._id}
                  className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0"
                >
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      <span className="font-medium">{log.action.replace(/\./g, " ").replace(/_/g, " ")}</span>
                    </p>
                    <p className="text-xs text-zinc-500">{formatTime(log.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
