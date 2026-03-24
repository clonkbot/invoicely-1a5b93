import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Plus, Search, Mail, MapPin, Building2, MoreVertical, Trash2, Edit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomersProps {
  orgId: Id<"organizations">;
}

interface Customer {
  _id: Id<"customers">;
  name: string;
  email: string;
  country: string;
  vatNumber?: string;
}

export function Customers({ orgId }: CustomersProps) {
  const customers = useQuery(api.customers.list, { orgId });
  const createCustomer = useMutation(api.customers.create);
  const deleteCustomer = useMutation(api.customers.remove);

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<Id<"customers"> | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "",
    vatNumber: "",
    address: "",
  });

  const filteredCustomers = customers?.filter(
    (c: Customer) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCustomer({
      orgId,
      name: formData.name,
      email: formData.email,
      country: formData.country,
      vatNumber: formData.vatNumber || undefined,
      address: formData.address || undefined,
    });
    setFormData({ name: "", email: "", country: "", vatNumber: "", address: "" });
    setShowForm(false);
  };

  const handleDelete = async (id: Id<"customers">) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      await deleteCustomer({ id });
      setMenuOpen(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold text-white mb-2">Customers</h1>
          <p className="text-zinc-400">Manage your customer base</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Customer List */}
      <div className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filteredCustomers?.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5"
            >
              <Building2 className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No customers found</p>
            </motion.div>
          ) : (
            filteredCustomers?.map((customer: Customer) => (
              <motion.div
                key={customer._id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-semibold text-amber-500">
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium text-white truncate">{customer.name}</h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          {customer.country}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setMenuOpen(menuOpen === customer._id ? null : customer._id)}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5 text-zinc-400" />
                    </button>

                    {menuOpen === customer._id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute right-0 top-full mt-2 w-40 bg-[#1A1A24] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden"
                      >
                        <button
                          onClick={() => handleDelete(customer._id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </motion.div>
                    )}
                  </div>
                </div>

                {customer.vatNumber && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <span className="text-xs text-zinc-500">VAT: {customer.vatNumber}</span>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Add Customer Modal */}
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
              <h2 className="text-xl font-display font-semibold text-white mb-6">Add Customer</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Country *</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g., United States"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">VAT Number</label>
                  <input
                    type="text"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    placeholder="Optional"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                  >
                    Add Customer
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
