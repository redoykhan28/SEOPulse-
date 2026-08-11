import { login, signup, signInWithGoogle } from './actions'
import { Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; type?: string }>
}) {
  const { message, type } = await searchParams

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black flex flex-col items-center justify-center p-4 transition-colors duration-200">
      <Link href="/" className="flex items-center mb-8 hover:opacity-80 transition-opacity">
        <Activity className="h-8 w-8 text-indigo-500 mr-2" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">SEOPulse</span>
      </Link>

      <div className="w-full max-w-md bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-xl dark:shadow-none dark:backdrop-blur-md">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Welcome back</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">Sign in or create an account to continue</p>

        {/* Alert banner */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${
            type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
          }`}>
            {type === 'success'
              ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
              : <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            }
            <span>{message}</span>
          </div>
        )}

        <form className="space-y-4 flex flex-col">
          <div>
            <label
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              htmlFor="email"
            >
              Email address
            </label>
            <input
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-black/50 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              formAction={login}
              className="flex-1 cursor-pointer bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
            >
              Sign In
            </button>
            <button
              formAction={signup}
              className="flex-1 cursor-pointer bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white py-2.5 rounded-xl font-semibold transition-all"
            >
              Sign Up
            </button>
          </div>
        </form>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
          <span className="text-sm text-gray-400 font-medium">OR</span>
          <div className="h-px bg-gray-200 dark:bg-white/10 flex-1"></div>
        </div>

        <form className="mt-6">
          <button
            formAction={signInWithGoogle}
            className="w-full cursor-pointer flex items-center justify-center px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 font-medium transition-all"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          By continuing, you agree to our{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">Terms</a>
          {' '}and{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-300">Privacy Policy</a>.
        </p>
      </div>
    </div>
  )
}
