import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Send,
  RefreshCw,
  MoreVertical,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InvoicesProps {
  orgId: Id<"organizations">;
}

interface LineItem {
  description: string;
  total: number;
}

interface Invoice {
  _id: Id<"invoices">;
  invoiceNumber: string;
  status: string;
  total: number;
  vatAmount: number;
  currency: string;
  dueDate: number;
  isProrated: boolean;
  lineItems: LineItem[];
  customer?: { name: string } | null;
}

export function Invoices({ orgId }: InvoicesProps) {
  const invoices = useQuery(api.invoices.list, { orgId });
  const markAsPaid = useMutation(api.invoices.markAsPaid);
  const sendInvoice = useMutation(api.invoices.send);
  const cancelInvoice = useMutation(api.invoices.cancel);
  const retryPayment = useMutation(api.payments.retryPayment);

  const [filter, setFilter] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState<Id<"invoices"> | null>(null);
  const [retrying, setRetrying] = useState<Id<"invoices"> | null>(null);

  const filteredInvoices = invoices?.filter((inv: Invoice) => {
    if (filter === "all") return true;
    return inv.status === filter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case "sent":
        return <Clock className="w-5 h-5 text-blue-400" />;
      case "overdue":
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case "draft":
        return <FileText className="w-5 h-5 text-zinc-400" />;
      case "cancelled":
        return <XCircle className="w-5 h-5 text-zinc-500" />;
      default:
        return <FileText className="w-5 h-5 text-zinc-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-emerald-500/20 text-emerald-400";
      case "sent":
        return "bg-blue-500/20 text-blue-400";
      case "overdue":
        return "bg-red-500/20 text-red-400";
      case "draft":
        return "bg-zinc-500/20 text-zinc-400";
      case "cancelled":
        return "bg-zinc-600/20 text-zinc-500";
      default:
        return "bg-zinc-500/20 text-zinc-400";
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleRetryPayment = async (invoiceId: Id<"invoices">) => {
    setRetrying(invoiceId);
    try {
      const result = await retryPayment({ invoiceId });
      if (result.success) {
        alert("Payment successful!");
      } else {
        alert("Payment failed. Will retry automatically.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRetrying(null);
      setMenuOpen(null);
    }
  };

  const statusFilters = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "sent", label: "Sent" },
    { value: "paid", label: "Paid" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Invoices</h1>
        <p className="text-zinc-400">Track and manage all invoices</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.value
                ? "bg-amber-500 text-black"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredInvoices?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5"
            >
              <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No invoices found</p>
            </motion.div>
          ) : (
            filteredInvoices?.map((invoice: Invoice) => (
              <motion.div
                key={invoice._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="p-3 rounded-xl bg-white/5 flex-shrink-0">
                      {getStatusIcon(invoice.status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-medium text-white">{invoice.invoiceNumber}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                        {invoice.isProrated && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
                            Prorated
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 truncate">
                        {invoice.customer?.name || "Unknown"} · Due {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        incl. {formatCurrency(invoice.vatAmount, invoice.currency)} VAT
                      </p>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === invoice._id ? null : invoice._id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-zinc-400" />
                      </button>

                      {menuOpen === invoice._id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute right-0 top-full mt-2 w-48 bg-[#1A1A24] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden"
                        >
                          {invoice.status === "draft" && (
                            <button
                              onClick={() => {
                                sendInvoice({ id: invoice._id });
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                              Send Invoice
                            </button>
                          )}
                          {["sent", "overdue"].includes(invoice.status) && (
                            <>
                              <button
                                onClick={() => {
                                  markAsPaid({ id: invoice._id });
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              >
                                <DollarSign className="w-4 h-4" />
                                Mark as Paid
                              </button>
                              <button
                                onClick={() => handleRetryPayment(invoice._id)}
                                disabled={retrying === invoice._id}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={`w-4 h-4 ${retrying === invoice._id ? "animate-spin" : ""}`} />
                                {retrying === invoice._id ? "Processing..." : "Retry Payment"}
                              </button>
                            </>
                          )}
                          {["draft", "sent", "overdue"].includes(invoice.status) && (
                            <button
                              onClick={() => {
                                if (confirm("Are you sure you want to cancel this invoice?")) {
                                  cancelInvoice({ id: invoice._id });
                                }
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                              Cancel Invoice
                            </button>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Line items preview */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="space-y-2">
                    {invoice.lineItems.slice(0, 2).map((item: LineItem, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-zinc-400 truncate flex-1 mr-4">{item.description}</span>
                        <span className="text-zinc-300 flex-shrink-0">{formatCurrency(item.total, invoice.currency)}</span>
                      </div>
                    ))}
                    {invoice.lineItems.length > 2 && (
                      <p className="text-xs text-zinc-500">+{invoice.lineItems.length - 2} more items</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
