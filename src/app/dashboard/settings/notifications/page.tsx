"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, MessageSquare, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ALERT_TYPES = [
  { id: "score_drop", label: "SEO Score Drop", desc: "Alert when overall SEO score drops significantly", severity: "high" },
  { id: "broken_links", label: "Broken Links Detected", desc: "Alert when new broken links are found on the site", severity: "high" },
  { id: "title_change", label: "Title Tag Changed", desc: "Alert when a page's title tag is modified", severity: "medium" },
  { id: "meta_change", label: "Meta Description Changed", desc: "Alert when a meta description is modified", severity: "medium" },
  { id: "sitemap_unavailable", label: "Sitemap Unavailable", desc: "Alert when sitemap.xml becomes inaccessible", severity: "high" },
  { id: "site_offline", label: "Site Goes Offline", desc: "Alert when the site returns a 5xx or times out", severity: "high" },
  { id: "minor_seo_change", label: "Minor SEO Changes", desc: "Alert on minor SEO improvements or regressions", severity: "low" },
];

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then(r => r.json())
      .then(d => {
        const map: Record<string, boolean> = {};
        (d.preferences || []).forEach((p: { alertType: string; enabled: boolean }) => {
          map[p.alertType] = p.enabled;
        });
        // Default unset prefs to enabled
        ALERT_TYPES.forEach(a => {
          if (!(a.id in map)) map[a.id] = true;
        });
        setPrefs(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (alertType: string) => {
    const newVal = !prefs[alertType];
    setPrefs(prev => ({ ...prev, [alertType]: newVal }));
    setSaving(alertType);
    try {
      await fetch("/api/notifications/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertType, enabled: newVal }),
      });
    } catch (e) {
      // Revert on error
      setPrefs(prev => ({ ...prev, [alertType]: !newVal }));
    } finally {
      setSaving(null);
    }
  };

  const SEVERITY_BADGE: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400",
    low: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Notification Preferences</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control which alerts you receive and through which channels.</p>
      </div>

      {/* Channels info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Bell, label: "In-App", desc: "Always on — shown in the bell menu", active: true },
          { icon: Mail, label: "Email (Resend)", desc: "Add RESEND_API_KEY to .env to enable", active: !!process.env.NEXT_PUBLIC_RESEND_ENABLED },
          { icon: MessageSquare, label: "Slack / Discord", desc: "Add webhook URLs to .env to enable", active: false },
        ].map(ch => (
          <div key={ch.label} className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl p-4 flex items-start gap-3">
            <div className={cn("p-2 rounded-lg", ch.active ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-white/5 text-gray-400")}>
              <ch.icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">{ch.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ch.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert toggles */}
      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Alert Types</h2>
        </div>
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 text-indigo-500 animate-spin" /></div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {ALERT_TYPES.map(a => (
              <div key={a.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{a.label}</span>
                    <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase rounded", SEVERITY_BADGE[a.severity])}>{a.severity}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</p>
                </div>
                <button
                  onClick={() => toggle(a.id)}
                  disabled={saving === a.id}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2",
                    prefs[a.id] ? "bg-indigo-600" : "bg-gray-200 dark:bg-white/20"
                  )}
                >
                  <span className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    prefs[a.id] ? "translate-x-5" : "translate-x-0"
                  )}>
                    {saving === a.id && <Loader2 className="h-3 w-3 text-gray-400 m-1 animate-spin" />}
                    {saving !== a.id && prefs[a.id] && <Check className="h-3 w-3 text-indigo-600 m-1" />}
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
