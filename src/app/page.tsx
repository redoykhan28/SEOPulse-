import Link from "next/link";
import { Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div className="flex justify-center items-center mb-8">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <Activity className="h-16 w-16 text-indigo-500" />
          </div>
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight">
          SEOPulse
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          The always-on technical SEO monitor for agencies. Track health scores, catch broken links, and automate client reporting.
        </p>
        
        <div className="pt-8">
          <Link 
            href="/dashboard"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_35px_rgba(79,70,229,0.6)] transition-all duration-300 transform hover:-translate-y-1"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
