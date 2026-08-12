"use client";

import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            View and manage your generated SEO reports.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111111] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
        <div className="p-16 text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Reports Coming Soon</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            The reporting module is currently under development. Soon you will be able to generate beautiful PDF and web reports for your clients.
          </p>
        </div>
      </div>
    </div>
  );
}
