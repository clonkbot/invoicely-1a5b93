import { useAuthActions } from "@convex-dev/auth/react";
import { Id } from "../../convex/_generated/dataModel";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  History,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

type View = "dashboard" | "customers" | "plans" | "subscriptions" | "invoices" | "audit" | "settings";

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  organizations: Array<{ _id: Id<"organizations">; name: string; role?: string }>;
  selectedOrgId: Id<"organizations"> | null;
  onOrgSelect: (id: Id<"organizations">) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "plans", label: "Plans", icon: CreditCard },
  { id: "subscriptions", label: "Subscriptions", icon: Receipt },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "audit", label: "Audit Log", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  currentView,
  onViewChange,
  organizations,
  selectedOrgId,
  onOrgSelect,
}: SidebarProps) {
  const { signOut } = useAuthActions();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [showNewOrgForm, setShowNewOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");

  const createOrg = useMutation(api.organizations.create);

  const selectedOrg = organizations.find((o) => o._id === selectedOrgId);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      const newOrgId = await createOrg({ name: newOrgName.trim() });
      onOrgSelect(newOrgId);
      setNewOrgName("");
      setShowNewOrgForm(false);
      setOrgDropdownOpen(false);
    } catch (err) {
      console.error("Failed to create organization:", err);
    }
  };

  return (
    <div className="w-72 h-screen bg-[#0D0D12] border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-lg font-bold text-black font-display">IV</span>
          </div>
          <div>
            <h1 className="font-display font-semibold text-white">Invoicely</h1>
            <p className="text-xs text-zinc-500">Billing Platform</p>
          </div>
        </div>
      </div>

      {/* Org selector */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {selectedOrg?.name || "Select Organization"}
              </p>
              {selectedOrg?.role && (
                <p className="text-xs text-zinc-500 capitalize">{selectedOrg.role}</p>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${orgDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {orgDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-[#15151C] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="max-h-48 overflow-y-auto">
                {organizations.map((org) => (
                  <button
                    key={org._id}
                    onClick={() => {
                      onOrgSelect(org._id);
                      setOrgDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors ${
                      org._id === selectedOrgId ? "bg-amber-500/10" : ""
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-sm text-white truncate">{org.name}</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 p-2">
                {showNewOrgForm ? (
                  <form onSubmit={handleCreateOrg} className="p-2">
                    <input
                      type="text"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      placeholder="Organization name"
                      autoFocus
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-amber-500 text-black text-xs font-medium rounded-lg hover:bg-amber-400"
                      >
                        Create
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewOrgForm(false)}
                        className="flex-1 py-1.5 bg-white/5 text-zinc-400 text-xs font-medium rounded-lg hover:bg-white/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewOrgForm(true)}
                    className="w-full flex items-center gap-2 p-2 text-sm text-amber-500 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Organization
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive
                  ? "bg-gradient-to-r from-amber-500/10 to-orange-600/10 text-amber-500 border border-amber-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-amber-500" : ""}`} />
              <span className="text-sm font-medium">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
}
