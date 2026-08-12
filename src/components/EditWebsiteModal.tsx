"use client";

import { useState, useEffect } from "react";
import { X, Settings, Loader2, CheckCircle2, Plus, Trash2, Bell } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface EditWebsiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  website: {
    id: string;
    url: string;
    scanFrequency: string;
    notifyEmails: string[];
    enabledAlerts: string[];
  };
}

const SCAN_FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const ALERT_TYPES = [
  { id: "score_drop",          emoji: "📉", label: "SEO Score Drop",           desc: "When your SEO score decreases after a scan" },
  { id: "broken_links",        emoji: "🔗", label: "Broken Links",              desc: "When 404 or dead links are detected on your site" },
  { id: "site_offline",        emoji: "🚨", label: "Site Offline",              desc: "When your site becomes unreachable" },
  { id: "title_change",        emoji: "✏️",  label: "Title Tag Changed",         desc: "When a page title changes between scans" },
  { id: "meta_change",         emoji: "🔍", label: "Meta Description Changed",  desc: "When a page meta description changes" },
  { id: "sitemap_unavailable", emoji: "🗺️",  label: "Sitemap Unavailable",       desc: "When your sitemap.xml cannot be found" },
];

export function EditWebsiteModal({ isOpen, onClose, onSuccess, website }: EditWebsiteModalProps) {
  const [frequency, setFrequency] = useState(website.scanFrequency);
  const [emails, setEmails] = useState<string[]>(website.notifyEmails || []);
  const [enabledAlerts, setEnabledAlerts] = useState<string[]>(
    website.enabledAlerts?.length > 0
      ? website.enabledAlerts
      : ALERT_TYPES.map(a => a.id)
  );
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"general" | "alerts">("general");
  const { success: showSuccess, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      setFrequency(website.scanFrequency);
      setEmails(website.notifyEmails || []);
      setEnabledAlerts(
        website.enabledAlerts?.length > 0
          ? website.enabledAlerts
          : ALERT_TYPES.map(a => a.id)
      );
      setNewEmail("");
      setError("");
      setActiveTab("general");
    }
  }, [isOpen, website]);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (emails.includes(email)) {
      setError("Email already added");
      return;
    }
    setEmails([...emails, email]);
    setNewEmail("");
    setError("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setEmails(emails.filter((e) => e !== emailToRemove));
  };

  const toggleAlert = (alertId: string) => {
    setEnabledAlerts(prev =>
      prev.includes(alertId)
        ? prev.filter(a => a !== alertId)
        : [...prev, alertId]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/websites/${website.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanFrequency: frequency, notifyEmails: emails, enabledAlerts }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to update settings.");
        showError("Update failed", data.error);
        setIsLoading(false);
        return;
      }

      showSuccess("Settings Saved", `Updated settings for ${website.url}.`);
      onSuccess();
      onClose();
    } catch {
      setError("Something went wrong. Please check your connection.");
      showError("Connection Error", "Please check your network connection.");
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl transition-colors duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg">
              <Settings className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Website Settings</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[240px] truncate">{website.url}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-white/10 flex-shrink-0">
          {[
            { id: "general", label: "General" },
            { id: "alerts",  label: "Alert Types" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as "general" | "alerts")}
              className={cn(
                "flex-1 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ── General Tab ── */}
            {activeTab === "general" && (
              <>
                {/* Scan Frequency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Automated Scan Frequency
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {SCAN_FREQUENCIES.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setFrequency(f.value)}
                        className={cn(
                          "py-2 text-sm font-medium rounded-lg border transition-all duration-150",
                          frequency === f.value
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                            : "bg-gray-50 dark:bg-black/30 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional Emails */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notification Emails
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Additional addresses to notify when alerts are triggered for this website.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); } }}
                      placeholder="colleague@example.com"
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="px-3 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                  {emails.length > 0 && (
                    <ul className="space-y-2">
                      {emails.map((email) => (
                        <li key={email} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{email}</span>
                          <button type="button" onClick={() => handleRemoveEmail(email)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}

            {/* ── Alerts Tab ── */}
            {activeTab === "alerts" && (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="h-4 w-4 text-indigo-500" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Alert Types</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Choose which events trigger email notifications for this website.
                </p>
                <div className="space-y-2">
                  {ALERT_TYPES.map((alert) => {
                    const isEnabled = enabledAlerts.includes(alert.id);
                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => toggleAlert(alert.id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all",
                          isEnabled
                            ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30"
                            : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/10 opacity-60"
                        )}
                      >
                        <span className="text-xl w-8 text-center flex-shrink-0">{alert.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{alert.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{alert.desc}</div>
                        </div>
                        {/* Toggle pill */}
                        <div className={cn(
                          "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                          isEnabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-white/20"
                        )}>
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all",
                            isEnabled ? "left-5" : "left-0.5"
                          )} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
                  {enabledAlerts.length} of {ALERT_TYPES.length} alerts enabled
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm">
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-white/10 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><CheckCircle2 className="h-4 w-4" />Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
