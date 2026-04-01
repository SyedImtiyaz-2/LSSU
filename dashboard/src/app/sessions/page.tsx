"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Session } from "@/lib/api";
import Badge from "@/components/Badge";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2, CheckCircle, AlertCircle, X } from "lucide-react";

const ICP_OPTIONS = [
  { id: 1,  name: "Traditional" },
  { id: 2,  name: "Transfer" },
  { id: 3,  name: "Transfer Back" },
  { id: 4,  name: "Canadian" },
  { id: 5,  name: "Charter" },
  { id: 6,  name: "Indigenous" },
  { id: 7,  name: "Cannabis" },
  { id: 8,  name: "Fisheries" },
  { id: 9,  name: "Fire Science" },
  { id: 10, name: "Nursing" },
  { id: 11, name: "Robotics" },
  { id: 12, name: "Hockey (M)" },
  { id: 13, name: "Hockey (W)" },
];

interface EditForm {
  name: string;
  email: string;
  phone: string;
  chat_summary: string;
  resolved: boolean;
  human_requested: boolean;
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [loading, setLoading]           = useState(true);
  const [icpFilter, setIcpFilter]       = useState<number | undefined>();
  const [resolvedFilter, setResolvedFilter]   = useState<boolean | undefined>();
  const [escalatedFilter, setEscalatedFilter] = useState<boolean | undefined>();

  // Edit modal
  const [editTarget, setEditTarget]     = useState<Session | null>(null);
  const [editForm, setEditForm]         = useState<EditForm | null>(null);
  const [saving, setSaving]             = useState(false);
  const [editError, setEditError]       = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = (icp?: number, resolved?: boolean, escalated?: boolean) => {
    setLoading(true);
    api.sessions({ icp_id: icp, resolved, human_requested: escalated, limit: 100 })
      .then((r) => setSessions(r.sessions))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const applyFilters = (icp = icpFilter, res = resolvedFilter, esc = escalatedFilter) =>
    load(icp, res, esc);

  /* ── Quick-toggle resolved / escalated ───────────────────────────────── */
  const quickToggle = async (s: Session, field: "resolved" | "human_requested", e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await api.updateSession(s.session_id, { [field]: !s[field] });
    setSessions((prev) => prev.map((x) => x.session_id === s.session_id ? { ...x, ...updated } : x));
  };

  /* ── Open edit modal ─────────────────────────────────────────────────── */
  const openEdit = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTarget(s);
    setEditError("");
    setEditForm({
      name: s.name ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      chat_summary: s.chat_summary ?? "",
      resolved: s.resolved,
      human_requested: s.human_requested,
    });
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm) return;
    setSaving(true);
    setEditError("");
    try {
      const updated = await api.updateSession(editTarget.session_id, {
        name: editForm.name || undefined,
        email: editForm.email || undefined,
        phone: editForm.phone || undefined,
        chat_summary: editForm.chat_summary || undefined,
        resolved: editForm.resolved,
        human_requested: editForm.human_requested,
      });
      setSessions((prev) => prev.map((x) => x.session_id === editTarget.session_id ? { ...x, ...updated } : x));
      setEditTarget(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* ── Delete ──────────────────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSession(deleteTarget.session_id);
      setSessions((prev) => prev.filter((x) => x.session_id !== deleteTarget.session_id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Chat Sessions</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
          value={icpFilter ?? ""}
          onChange={(e) => {
            const v = e.target.value ? Number(e.target.value) : undefined;
            setIcpFilter(v);
            applyFilters(v, resolvedFilter, escalatedFilter);
          }}
        >
          <option value="">All ICPs</option>
          {ICP_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
          value={resolvedFilter === undefined ? "" : String(resolvedFilter)}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : e.target.value === "true";
            setResolvedFilter(v);
            applyFilters(icpFilter, v, escalatedFilter);
          }}
        >
          <option value="">All Statuses</option>
          <option value="true">Resolved</option>
          <option value="false">Unresolved</option>
        </select>

        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
          value={escalatedFilter === undefined ? "" : String(escalatedFilter)}
          onChange={(e) => {
            const v = e.target.value === "" ? undefined : e.target.value === "true";
            setEscalatedFilter(v);
            applyFilters(icpFilter, resolvedFilter, v);
          }}
        >
          <option value="">All Escalations</option>
          <option value="true">Escalated only</option>
          <option value="false">Not escalated</option>
        </select>

        <span className="ml-auto text-xs text-gray-400">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading sessions…</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">ICP</th>
                <th className="px-4 py-3 text-left">Msgs</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Started</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.session_id}
                  className="border-t border-gray-50 hover:bg-[#E8F4FD] transition-colors cursor-pointer"
                  onClick={() => router.push(`/sessions/${s.session_id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.name ?? <span className="text-gray-400 italic">Anonymous</span>}</div>
                    <div className="text-xs text-gray-600">{s.email ?? s.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-medium">{s.icp_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{s.message_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {s.human_requested
                        ? <Badge label="Escalated" variant="red" />
                        : s.resolved
                        ? <Badge label="Resolved" variant="green" />
                        : <Badge label="Active" variant="blue" />}
                      <button
                        title={s.resolved ? "Mark unresolved" : "Mark resolved"}
                        onClick={(e) => quickToggle(s, "resolved", e)}
                        className="text-gray-300 hover:text-green-500 transition-colors"
                      >
                        <CheckCircle size={14} />
                      </button>
                      <button
                        title={s.human_requested ? "Clear escalation" : "Escalate"}
                        onClick={(e) => quickToggle(s, "human_requested", e)}
                        className="text-gray-300 hover:text-red-400 transition-colors"
                      >
                        <AlertCircle size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : "—"}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => openEdit(s, e)}
                        className="p-1.5 rounded-lg hover:bg-[#003F6B]/10 text-[#003F6B] transition-colors"
                        title="Edit session"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                        title="Delete session"
                      >
                        <Trash2 size={14} />
                      </button>
                      <span
                        onClick={() => router.push(`/sessions/${s.session_id}`)}
                        className="text-[#003F6B] text-xs font-medium hover:underline cursor-pointer"
                      >
                        View →
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-300 py-12">No sessions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────── */}
      {editTarget && editForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Edit Session</h2>
              <button onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Name</label>
                  <input
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Student name"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Phone</label>
                  <input
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Email</label>
                <input
                  type="email"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="student@email.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">Notes</label>
                <textarea
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30 resize-none"
                  value={editForm.chat_summary}
                  onChange={(e) => setEditForm({ ...editForm, chat_summary: e.target.value })}
                  placeholder="Internal notes…"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#003F6B]"
                    checked={editForm.resolved}
                    onChange={(e) => setEditForm({ ...editForm, resolved: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">Resolved</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-red-500"
                    checked={editForm.human_requested}
                    onChange={(e) => setEditForm({ ...editForm, human_requested: e.target.checked })}
                  />
                  <span className="text-sm text-gray-700">Escalated</span>
                </label>
              </div>
              {editError && <p className="text-xs text-red-500">{editError}</p>}
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="px-5 py-2 text-sm rounded-lg bg-[#003F6B] text-white font-medium hover:bg-[#005596] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Delete session?</h2>
              <p className="text-sm text-gray-500">
                This permanently removes the session for{" "}
                <span className="font-medium text-gray-700">{deleteTarget.name ?? "Anonymous"}</span>{" "}
                and all its messages. This cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
