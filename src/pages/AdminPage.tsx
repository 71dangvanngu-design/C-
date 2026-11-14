import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  KeyRound,
  Layout,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useHub } from '../context/HubContext';
import { hasAdminAccess } from '../lib/authPolicy';
import type { AdminOverviewPayload } from '../types/hub';
import { AdminLessonsTab } from '../components/admin/AdminLessonsTab';
import { AdminSiteStructureTab } from '../components/admin/AdminSiteStructureTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';

type AdminTab = 'lessons' | 'structure' | 'users';

export function AdminPage() {
  const { user, authLoading, changePassword, refreshSite, navigate } = useHub();
  const [activeTab, setActiveTab] = useState<AdminTab>('lessons');
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Forced initial password change state
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const isAdmin = hasAdminAccess(user);

  const loadOverview = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/admin/overview', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as AdminOverviewPayload;
        setOverview(data);
      }
    } finally {
      setLoadingOverview(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && user && !user.mustChangePassword) {
      void loadOverview();
    }
  }, [isAdmin, user, loadOverview]);

  const handleDataChanged = async () => {
    await Promise.all([loadOverview(), refreshSite()]);
  };

  const handleForcedPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) {
      setPwError('New password confirmation does not match.');
      return;
    }
    setPwSubmitting(true);
    const res = await changePassword(curPw, newPw);
    setPwSubmitting(false);

    if (!res.ok) {
      setPwError(res.error);
      return;
    }

    setCurPw('');
    setNewPw('');
    setConfirmPw('');
    setSuccessMsg('Default Super Administrator password rotated. Control Panel unlocked.');
    await loadOverview();
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="h-64 rounded-xl bg-[#0D1320] border border-slate-800 animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-cyan-400 mx-auto mb-3" aria-hidden="true" />
        <h1 className="font-display text-2xl font-bold text-slate-100">
          Administrator Authentication Required
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Please sign in with an administrator account to access the control panel.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 rounded-md bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 cursor-pointer"
        >
          Go to Login
        </button>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" aria-hidden="true" />
        <h1 className="font-display text-2xl font-bold text-slate-100">
          403 · Access Forbidden
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Standard user accounts cannot access the ADMIN CONTROL PANEL.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 rounded-md bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 cursor-pointer"
        >
          Return to Homepage
        </button>
      </main>
    );
  }

  // Mandatory first-login password change gate
  if (user.mustChangePassword) {
    return (
      <main className="min-h-[calc(100vh-73px)] cyber-grid-bg flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg rounded-xl border border-amber-500/40 bg-[#0D1320] p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <KeyRound className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-mono text-amber-400">FIRST-LOGIN SECURITY REQUIREMENT</p>
              <h1 className="font-display text-xl font-bold text-slate-100">
                Change Default ADMIN Password
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            The initial password is for first-time setup only. You must set a new strong password
            before accessing the ADMIN CONTROL PANEL.
          </p>

          {pwError ? (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
              <span>{pwError}</span>
            </div>
          ) : null}

          <form onSubmit={handleForcedPasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-init-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
                Current Initial Password
              </label>
              <input
                id="admin-init-pw"
                type="password"
                required
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="admin-new-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
                New Password (min 8 characters)
              </label>
              <input
                id="admin-new-pw"
                type="password"
                required
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="admin-confirm-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                id="admin-confirm-pw"
                type="password"
                required
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={pwSubmitting}
              className="w-full rounded-md bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 cursor-pointer"
            >
              {pwSubmitting ? 'Updating Password...' : 'Set New Password & Unlock Panel'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 mb-8">
        <div>
          <p className="text-xs font-mono tracking-wider text-cyan-400 mb-1">
            Super Administrator · {user.username}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            ADMIN CONTROL PANEL
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-md border border-slate-700 bg-[#0D1320] px-4 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50 cursor-pointer"
          >
            View Live Website
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-xs text-rose-300 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {successMsg ? (
        <div
          role="status"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-emerald-300 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 space-y-2">
          <button
            type="button"
            onClick={() => setActiveTab('lessons')}
            className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'lessons'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Lessons &amp; Categories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'structure'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Layout className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Header, Layout &amp; Components</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Users &amp; Roles</span>
          </button>

          {overview ? (
            <div className="mt-6 rounded-lg border border-slate-800/80 bg-[#0D1320] p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <Shield className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                <span>System Summary</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Lessons</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {overview.allLessons.length}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Published</span>
                <span className="font-mono tabular-nums text-emerald-400">
                  {overview.allLessons.filter((l) => l.status === 'published').length}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Registered Accounts</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {overview.users.length}
                </span>
              </div>
            </div>
          ) : null}
        </aside>

        {/* Main Panel Content */}
        <div className="lg:col-span-9">
          {loadingOverview && !overview ? (
            <div className="h-72 rounded-xl bg-[#0D1320] border border-slate-800 animate-pulse" />
          ) : overview ? (
            <>
              {activeTab === 'lessons' ? (
                <AdminLessonsTab
                  lessons={overview.allLessons}
                  categories={overview.categories}
                  onChanged={handleDataChanged}
                  onError={setErrorMsg}
                />
              ) : null}

              {activeTab === 'structure' ? (
                <AdminSiteStructureTab
                  tabs={overview.allHeaderTabs}
                  sections={overview.allSections}
                  settings={overview.settings}
                  onChanged={handleDataChanged}
                  onError={setErrorMsg}
                  onSuccess={setSuccessMsg}
                />
              ) : null}

              {activeTab === 'users' ? (
                <AdminUsersTab
                  users={overview.users}
                  currentAdminId={user.id}
                  onChanged={handleDataChanged}
                  onError={setErrorMsg}
                  onSuccess={setSuccessMsg}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
