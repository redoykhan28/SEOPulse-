import { Bell, Menu, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="h-16 bg-white dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="flex flex-1">
        <button type="button" className="md:hidden p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        
        <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#0a0a0a]" />
        </button>

        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium text-white border border-indigo-400/30">
            <User className="h-4 w-4" />
          </div>
        </div>
      </div>
    </header>
  );
}
