import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Building2, Plus, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface OrgSelectorProps {
  organizations: Array<{ _id: Id<"organizations">; name: string }>;
  selectedId: Id<"organizations"> | null;
  onSelect: (id: Id<"organizations">) => void;
}

export function OrgSelector({ organizations, selectedId, onSelect }: OrgSelectorProps) {
  const [showCreate, setShowCreate] = useState(organizations.length === 0);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const createOrg = useMutation(api.organizations.create);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const id = await createOrg({ name: name.trim() });
      onSelect(id);
      setName("");
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {organizations.length > 0 && !showCreate && (
        <div className="space-y-2">
          {organizations.map((org) => (
            <motion.button
              key={org._id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(org._id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${
                selectedId === org._id
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-lg font-medium text-white">{org.name}</span>
              <ArrowRight className="w-5 h-5 text-zinc-400 ml-auto" />
            </motion.button>
          ))}
        </div>
      )}

      {showCreate ? (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="bg-white/5 border border-white/10 rounded-xl p-6"
        >
          <h3 className="text-lg font-medium text-white mb-4">Create Organization</h3>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Organization name"
            autoFocus
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 mb-4"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-semibold rounded-xl disabled:opacity-50 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
            >
              {isCreating ? "Creating..." : "Create"}
            </button>
            {organizations.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-6 py-3 bg-white/5 text-zinc-400 rounded-xl hover:bg-white/10"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.form>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-white/20 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Organization
        </button>
      )}
    </div>
  );
}
