"use client";

import { Bell, Menu, User, X, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleBellClick = () => {
    if (!showNotifications) loadNotifications();
    setShowNotifications(prev => !prev);
  };

  const TYPE_COLORS: Record<string, string> = {
    score_drop: "bg-red-500",
    broken_links: "bg-orange-500",
    title_change: "bg-yellow-500",
    meta_change: "bg-blue-500",
    sitemap_unavailable: "bg-purple-500",
    site_offline: "bg-red-700",
    minor_seo_change: "bg-gray-400",
  };

  return (
    <header className="h-16 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="flex flex-1">
        <button type="button" className="md:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      
      <div className="flex items-center space-x-2 sm:space-x-4">
        <ThemeToggle />
        
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            id="notification-bell-btn"
            onClick={handleBellClick}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0a0a0a] text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                      Mark all read
                    </button>
                  )}
                  <Link href="/dashboard/settings/notifications" className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <Settings className="h-4 w-4" />
                  </Link>
                  <button onClick={() => setShowNotifications(false)} className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto h-8 w-8 text-gray-200 dark:text-gray-700 mb-2" />
                    <p className="text-sm text-gray-400">No notifications yet</p>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id} className={cn(
                    "px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors",
                    !n.isRead && "bg-indigo-50/50 dark:bg-indigo-500/[0.04]"
                  )}>
                    <div className={cn("mt-1 h-2 w-2 flex-shrink-0 rounded-full", TYPE_COLORS[n.type] || "bg-gray-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                    </div>
                    {!n.isRead && <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium text-white border border-indigo-400/30">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
