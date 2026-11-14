import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { hasAdminAccess } from '../lib/authPolicy';

type AuthMode = 'login' | 'register' | 'forgot';

export function LoginPage() {
  const { siteData, login, register, forgotPassword, navigate } = useHub();
  const [mode, setMode] = useState<AuthMode>('login');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Forgot password field
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const allowRegistration = siteData?.settings.enableRegistration ?? true;

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    const res = await login(identifier, password);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg('LOGIN FAILED');
      return;
    }

    if (hasAdminAccess(res.user)) {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    const res = await register(regEmail, regUsername, regPassword);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    navigate('/');
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);

    const res = await forgotPassword(recoveryIdentifier);
    setSubmitting(false);
    if (!res.ok) {
      setErrorMsg(res.message);
    } else {
      setInfoMsg(res.message);
    }
  };

  return (
    <main className="min-h-[calc(100vh-73px)] cyber-grid-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[460px]">
        <div className="rounded-xl border border-slate-800 bg-[#0D1320] p-8 shadow-2xl">
          {/* Header */}
          <div className="mb-6">
            <p className="text-xs font-mono tracking-wider text-cyan-400 mb-2">
              DIGITAL KNOWLEDGE HUB
            </p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">
              {mode === 'login' && 'System Authentication'}
              {mode === 'register' && 'Create User Account'}
              {mode === 'forgot' && 'Password Recovery'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {mode === 'login' && 'Sign in with your Username or Email to continue.'}
              {mode === 'register' && 'Register a standard learner account with email verification.'}
              {mode === 'forgot' && 'Request password reset instructions for your account.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Authentication Modes"
            className="flex items-center gap-1 rounded-lg bg-[#080B12] p-1 border border-slate-800/80 mb-6"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'login'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              LOGIN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              disabled={!allowRegistration}
              onClick={() => switchMode('register')}
              className={`rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                mode === 'register'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              REGISTER
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'forgot'}
              onClick={() => switchMode('forgot')}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'forgot'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              FORGOT PASSWORD
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg ? (
            <div
              role="alert"
              className="mb-5 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm font-medium text-rose-200"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {infoMsg ? (
            <div
              role="status"
              className="mb-5 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm font-medium text-emerald-200"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{infoMsg}</span>
            </div>
          ) : null}

          {/* LOGIN FORM */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username hoặc Email
                </label>
                <input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ADMIN or user@domain.com"
                  className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-md border border-slate-700 bg-[#080B12] pl-3.5 pr-10 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Authenticating...' : 'LOGIN'}</span>
              </button>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!allowRegistration}
                  onClick={() => switchMode('register')}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-40 cursor-pointer"
                >
                  REGISTER
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  FORGOT PASSWORD
                </button>
              </div>
            </form>
          ) : null}

          {/* REGISTER FORM */}
          {mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="learner@example.com"
                  className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-username"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="reg-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. cyber_learner"
                  className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Password (min 8 characters)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Creating Account...' : 'REGISTER'}</span>
              </button>
            </form>
          ) : null}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' ? (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="forgot-identifier"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username hoặc Email
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  required
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  placeholder="Enter your registered email or username"
                  className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-60 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{submitting ? 'Sending...' : 'Send Recovery Link'}</span>
              </button>
            </form>
          ) : null}

          <div className="mt-6 pt-4 border-t border-slate-800/70 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-cyan-500/80 shrink-0" aria-hidden="true" />
            <span>Protected by role-verified session security and Supabase Auth RLS.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
