import { useConvexAuth } from "convex/react";
import { useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { Dashboard } from "./components/Dashboard";
import { Sidebar } from "./components/Sidebar";
import { Customers } from "./components/Customers";
import { Plans } from "./components/Plans";
import { Subscriptions } from "./components/Subscriptions";
import { Invoices } from "./components/Invoices";
import { AuditLogs } from "./components/AuditLogs";
import { Settings } from "./components/Settings";
import { OrgSelector } from "./components/OrgSelector";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type View = "dashboard" | "customers" | "plans" | "subscriptions" | "invoices" | "audit" | "settings";

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [selectedOrgId, setSelectedOrgId] = useState<Id<"organizations"> | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const organizations = useQuery(api.organizations.list);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <motion.div
          className="relative"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-16 h-16 border-4 border-amber-500/20 rounded-full" />
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-amber-500 rounded-full" />
        </motion.div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // Auto-select first org if none selected
  if (!selectedOrgId && organizations && organizations.length > 0) {
    setSelectedOrgId(organizations[0]._id);
  }

  const renderView = () => {
    if (!selectedOrgId) {
      return (
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-2xl font-display font-semibold text-white mb-2">No Organization Selected</h2>
            <p className="text-zinc-400 mb-6">Create or select an organization to get started</p>
            <OrgSelector
              organizations={organizations || []}
              selectedId={selectedOrgId}
              onSelect={setSelectedOrgId}
            />
          </motion.div>
        </div>
      );
    }

    const viewProps = { orgId: selectedOrgId };

    switch (currentView) {
      case "dashboard":
        return <Dashboard {...viewProps} />;
      case "customers":
        return <Customers {...viewProps} />;
      case "plans":
        return <Plans {...viewProps} />;
      case "subscriptions":
        return <Subscriptions {...viewProps} />;
      case "invoices":
        return <Invoices {...viewProps} />;
      case "audit":
        return <AuditLogs {...viewProps} />;
      case "settings":
        return <Settings {...viewProps} />;
      default:
        return <Dashboard {...viewProps} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white font-body flex flex-col">
      {/* Ambient gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-amber-500/5 via-transparent to-transparent" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-orange-600/5 via-transparent to-transparent" />
      </div>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="text-sm font-bold text-black">IV</span>
            </div>
            <span className="font-display font-semibold">Invoicely</span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72"
          >
            <Sidebar
              currentView={currentView}
              onViewChange={(view: View) => {
                setCurrentView(view);
                setMobileMenuOpen(false);
              }}
              organizations={organizations || []}
              selectedOrgId={selectedOrgId}
              onOrgSelect={setSelectedOrgId}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 pt-14 lg:pt-0">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            currentView={currentView}
            onViewChange={setCurrentView}
            organizations={organizations || []}
            selectedOrgId={selectedOrgId}
            onOrgSelect={setSelectedOrgId}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen lg:min-h-0 overflow-x-hidden">
          <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            {renderView()}
          </div>

          {/* Footer */}
          <footer className="px-4 md:px-6 lg:px-8 py-4 border-t border-white/5">
            <p className="text-xs text-zinc-600 text-center">
              Requested by <span className="text-zinc-500">@web-user</span> · Built by <span className="text-zinc-500">@clonkbot</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
