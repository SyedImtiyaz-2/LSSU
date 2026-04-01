"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Session, Message } from "@/lib/api";
import Badge from "@/components/Badge";
import { ArrowLeft, User, Bot, Pencil, Trash2, CheckCircle, XCircle, Save, X } from "lucide-react";
import { format } from "date-fns";
import clsx from "clsx";

export default function SessionDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const [session,  setSession]  = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit form state
  const [editName,    setEditName]    = useState("");
  const [editEmail,   setEditEmail]   = useState("");
  const [editPhone,   setEditPhone]   = useState("");
  const [editSummary, setEditSummary] = useState("");

  useEffect(() => {
    if (!id) return;
    api.sessionMessages(id)
      .then((r) => { setSession(r.session); setMessages(r.messages); })
      .finally(() => setLoading(false));
  }, [id]);

  const openEdit = () => {
    if (!session) return;
    setEditName(session.name ?? "");
    setEditEmail(session.email ?? "");
    setEditPhone(session.phone ?? "");
    setEditSummary(session.chat_summary ?? "");
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await api.updateSession(session.session_id, {
        name: editName || undefined,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        chat_summary: editSummary || undefined,
      });
      setSession((prev) => prev ? { ...prev, ...updated } : prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleResolved = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await api.updateSession(session.session_id, { resolved: !session.resolved });
      setSession((prev) => prev ? { ...prev, ...updated } : prev);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!session) return;
    setSaving(true);
    try {
      await api.deleteSession(session.session_id);
      router.push("/sessions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm py-12 text-center">Loading session…</p>;
  if (!session) return <p className="text-rose-500 text-sm py-12 text-center">Session not found.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-[#003F6B] hover:underline"
      >
        <ArrowLeft size={14} /> Back to Sessions
      </button>

      {/* Session metadata card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{session.name ?? "Anonymous Student"}</h1>
            <p className="text-sm text-gray-500 mt-1">{session.icp_name ?? "Unknown ICP"}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {session.human_requested
              ? <Badge label="Escalated" variant="red" />
              : session.resolved
              ? <Badge label="Resolved"  variant="green" />
              : <Badge label="Active"    variant="blue" />}

            {/* Resolve toggle */}
            <button
              disabled={saving}
              onClick={toggleResolved}
              title={session.resolved ? "Mark unresolved" : "Mark resolved"}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              {session.resolved
                ? <><XCircle size={13} className="text-gray-400" /> Unresolve</>
                : <><CheckCircle size={13} className="text-green-500" /> Resolve</>}
            </button>

            {/* Edit */}
            <button
              onClick={openEdit}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={13} /> Edit
            </button>

            {/* Delete */}
            <button
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 disabled:opacity-40 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 uppercase block mb-1">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                  placeholder="Student name"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase block mb-1">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  type="email"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase block mb-1">Phone</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  type="tel"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
                  placeholder="+1 555-000-0000"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase block mb-1">Notes / Summary</label>
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30 resize-none"
                placeholder="Internal notes about this session…"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                <X size={13} /> Cancel
              </button>
              <button
                disabled={saving}
                onClick={saveEdit}
                className="flex items-center gap-1 px-4 py-2 text-sm rounded-lg bg-[#003F6B] text-white hover:bg-[#005596] disabled:opacity-40"
              >
                <Save size={13} /> {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              ["Email",    session.email],
              ["Phone",    session.phone],
              ["Source",   session.referral_source],
              ["Page",     session.page_slug],
              ["Messages", session.message_count],
              ["Started",  session.created_at ? format(new Date(session.created_at), "MMM d, yyyy HH:mm") : "—"],
            ].map(([label, val]) => (
              <div key={label as string}>
                <dt className="text-xs text-gray-400 uppercase">{label}</dt>
                <dd className="font-medium text-gray-700 mt-0.5">{val ?? "—"}</dd>
              </div>
            ))}
            {session.chat_summary && (
              <div className="col-span-full">
                <dt className="text-xs text-gray-400 uppercase">Notes</dt>
                <dd className="text-gray-700 mt-0.5 text-sm">{session.chat_summary}</dd>
              </div>
            )}
          </dl>
        )}

        {session.unresolved_query && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-sm text-rose-700">
            <strong>Unresolved query:</strong> {session.unresolved_query}
          </div>
        )}
      </div>

      {/* Chat transcript */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-base font-semibold text-gray-700">Transcript</h2>

        {messages.filter((m) => m.role !== "system").map((msg) => (
          <div
            key={msg.id}
            className={clsx(
              "flex gap-3",
              msg.role === "user" ? "flex-row" : "flex-row-reverse"
            )}
          >
            <div className={clsx(
              "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
              msg.role === "user" ? "bg-gray-400" : "bg-[#003F6B]"
            )}>
              {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </div>

            <div className={clsx(
              "max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-gray-100 text-gray-800 rounded-tl-sm"
                : "bg-[#003F6B] text-white rounded-tr-sm"
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className={clsx(
                "text-xs mt-1 opacity-60",
                msg.role === "assistant" ? "text-right" : "text-left"
              )}>
                {msg.created_at ? format(new Date(msg.created_at), "HH:mm") : ""}
                {msg.rag_score !== null && msg.rag_score !== undefined && msg.role === "assistant"
                  ? ` · RAG ${(msg.rag_score * 100).toFixed(0)}%`
                  : ""}
              </p>
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <p className="text-gray-300 text-sm text-center py-8">No messages in this session.</p>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Delete session?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete this session and all its messages. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={doDelete}
                className="px-4 py-2 text-sm rounded-lg bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40"
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
