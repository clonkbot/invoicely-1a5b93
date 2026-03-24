import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { History, User, Building2, CreditCard, Receipt, FileText, Webhook, DollarSign } from "lucide-react";
import { motion } from "framer-motion";

interface AuditLogsProps {
  orgId: Id<"organizations">;
}

interface LogEntry {
  _id: Id<"auditLogs">;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
  createdAt: number;
  user?: { email?: string } | null;
}

export function AuditLogs({ orgId }: AuditLogsProps) {
  const logs = useQuery(api.auditLogs.list, { orgId, limit: 100 });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "organization":
        return <Building2 className="w-4 h-4" />;
      case "customer":
        return <User className="w-4 h-4" />;
      case "plan":
        return <CreditCard className="w-4 h-4" />;
      case "subscription":
        return <Receipt className="w-4 h-4" />;
      case "invoice":
        return <FileText className="w-4 h-4" />;
      case "payment":
        return <DollarSign className="w-4 h-4" />;
      case "webhook":
        return <Webhook className="w-4 h-4" />;
      case "member":
        return <User className="w-4 h-4" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes("created") || action.includes("added")) {
      return "text-emerald-400 bg-emerald-500/10";
    }
    if (action.includes("deleted") || action.includes("cancelled")) {
      return "text-red-400 bg-red-500/10";
    }
    if (action.includes("failed")) {
      return "text-red-400 bg-red-500/10";
    }
    if (action.includes("succeeded") || action.includes("paid")) {
      return "text-emerald-400 bg-emerald-500/10";
    }
    return "text-blue-400 bg-blue-500/10";
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatAction = (action: string) => {
    return action
      .split(".")
      .map((part) =>
        part
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      )
      .join(" → ");
  };

  const parseDetails = (details?: string) => {
    if (!details) return null;
    try {
      return JSON.parse(details);
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Audit Log</h1>
        <p className="text-zinc-400">Complete history of all actions in your organization</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: logs?.length || 0, color: "text-white" },
          {
            label: "Today",
            value: logs?.filter((l: LogEntry) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return l.createdAt >= today.getTime();
            }).length || 0,
            color: "text-amber-400",
          },
          {
            label: "Payments",
            value: logs?.filter((l: LogEntry) => l.entityType === "payment").length || 0,
            color: "text-emerald-400",
          },
          {
            label: "Changes",
            value: logs?.filter((l: LogEntry) => l.action.includes("updated") || l.action.includes("changed")).length || 0,
            color: "text-blue-400",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white/[0.03] border border-white/10 rounded-xl p-4"
          >
            <p className={`text-2xl font-display font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Logs List */}
      <div className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 md:p-6 border-b border-white/5">
          <h2 className="text-lg font-display font-semibold text-white">Activity Timeline</h2>
        </div>

        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
          {logs?.length === 0 ? (
            <div className="p-8 md:p-12 text-center">
              <History className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No activity recorded yet</p>
            </div>
          ) : (
            logs?.map((log: LogEntry, index: number) => {
              const details = parseDetails(log.details);

              return (
                <motion.div
                  key={log._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="p-4 md:p-5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex gap-4">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${getActionColor(log.action)}`}>
                      {getEntityIcon(log.entityType)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium">{formatAction(log.action)}</p>
                          <p className="text-sm text-zinc-500 mt-0.5">
                            {log.entityType && (
                              <span className="capitalize">{log.entityType}</span>
                            )}
                            {log.entityId && (
                              <span className="font-mono text-xs ml-1 text-zinc-600">
                                {log.entityId.slice(0, 8)}...
                              </span>
                            )}
                          </p>
                        </div>

                        <p className="text-xs text-zinc-500 flex-shrink-0">{formatTime(log.createdAt)}</p>
                      </div>

                      {details && (
                        <div className="mt-2 text-sm">
                          {Object.entries(details)
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 mr-3 text-zinc-400"
                              >
                                <span className="text-zinc-500">{key}:</span>
                                <span className="text-zinc-300 truncate max-w-[150px]">
                                  {typeof value === "number"
                                    ? value.toLocaleString()
                                    : String(value)}
                                </span>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
