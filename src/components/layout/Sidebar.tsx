"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Globe,
  Settings,
  FileText,
  ChevronDown,
  Building2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/websites", label: "Websites", icon: Globe },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-white/10 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="md:hidden absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-white/10">
        <Activity className="h-6 w-6 text-indigo-500 mr-2 flex-shrink-0" />
        <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">SEOPulse</span>
      </div>

      {/* Org Switcher */}
      <div className="px-3 py-3 border-b border-gray-200 dark:border-white/10">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors group">
          <div className="flex items-center min-w-0">
            <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center mr-2 flex-shrink-0">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">My Organization</span>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          Menu
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 mr-3 flex-shrink-0",
                  isActive
                    ? "text-indigo-500"
                    : "text-gray-400 dark:text-gray-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-200 dark:border-white/10">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
            pathname === "/dashboard/settings"
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white"
          )}
        >
          <Settings className="h-5 w-5 mr-3 text-gray-400 dark:text-gray-500" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
