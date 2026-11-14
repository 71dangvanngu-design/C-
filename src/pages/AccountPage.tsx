import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, LogOut, Shield } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { hasAdminAccess } from '../lib/authPolicy';

export function AccountPage() {
  const { user, authLoading, changePassword, logout, navigate } = useHub();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="h-48 rounded-xl bg-[#0D1320] border border-slate-800 animate-pulse" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-100">Sign In Required</h1>
        <p className="mt-2 text-sm text-slate-400">
          Please authenticate to manage your account and password.
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password confirmation does not match.');
      return;
    }

    setSubmitting(true);
    const res = await changePassword(currentPassword, newPassword);
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSuccessMsg('Password updated successfully.');
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs font-mono text-cyan-400 mb-1">Profile Identity</p>
            <h1 className="font-display text-2xl font-bold text-slate-100">{user.username}</h1>
            <p className="text-sm text-slate-400 mt-1">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            {hasAdminAccess(user) ? (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ADMIN CONTROL PANEL</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-xs font-medium text-rose-300 hover:border-rose-500/50 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Role</dt>
            <dd className="mt-1 font-mono font-medium text-slate-100">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Account Type</dt>
            <dd className="mt-1 font-medium text-slate-100">{user.accountType}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Status</dt>
            <dd className="mt-1 font-medium text-emerald-400">
              {user.isActive ? 'Active' : 'Suspended'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6 sm:p-8">
        <h2 className="font-display text-xl font-bold text-slate-100 mb-1">Change Password</h2>
        <p className="text-sm text-slate-400 mb-6">
          Update your credentials to keep your DIGITAL KNOWLEDGE HUB account secure.
        </p>

        {errorMsg ? (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        ) : null}

        {successMsg ? (
          <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{successMsg}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="acct-cur-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
              Current Password
            </label>
            <input
              id="acct-cur-pw"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="acct-new-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
              New Password (min 8 characters)
            </label>
            <input
              id="acct-new-pw"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="acct-confirm-pw" className="block text-xs font-medium text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <input
              id="acct-confirm-pw"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{submitting ? 'Updating...' : 'Update Password'}</span>
          </button>
        </form>
      </section>
    </main>
  );
}
