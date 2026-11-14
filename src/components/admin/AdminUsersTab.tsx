import type { UserProfile, UserRole } from '../../types/hub';
import { isReservedUsername } from '../../lib/authPolicy';

interface AdminUsersTabProps {
  users: UserProfile[];
  currentAdminId: string;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function AdminUsersTab({
  users,
  currentAdminId,
  onChanged,
  onError,
  onSuccess,
}: AdminUsersTabProps) {
  const handleRoleChange = async (target: UserProfile, role: UserRole) => {
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || 'Failed to update user role.');
      return;
    }
    onSuccess(`Updated role for ${target.username} to ${role}.`);
    await onChanged();
  };

  const handleToggleActive = async (target: UserProfile) => {
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive: !target.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      onError(data.error || 'Failed to update user status.');
      return;
    }
    onSuccess(`Updated status for ${target.username}.`);
    await onChanged();
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
      <h2 className="font-display text-lg font-semibold text-slate-100 mb-1">
        Users &amp; Role Governance
      </h2>
      <p className="text-xs text-slate-400 mb-6">
        Manage user accounts and administrative permissions. Primary Super Administrator protection
        is enforced on both backend and database policies.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="py-2.5 pr-4 font-medium">Username</th>
              <th className="py-2.5 pr-4 font-medium">Email</th>
              <th className="py-2.5 pr-4 font-medium">Account Type</th>
              <th className="py-2.5 pr-4 font-medium">Role</th>
              <th className="py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {users.map((u) => {
              const isPrimaryAdmin = isReservedUsername(u.username);
              const isSelf = u.id === currentAdminId;
              return (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="py-3 pr-4 font-mono text-xs font-semibold text-slate-100">
                    {u.username}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-400">{u.email}</td>
                  <td className="py-3 pr-4 text-xs text-slate-300">{u.accountType}</td>
                  <td className="py-3 pr-4">
                    <select
                      aria-label={`Role for ${u.username}`}
                      disabled={isPrimaryAdmin || isSelf}
                      value={u.role}
                      onChange={(e) => void handleRoleChange(u, e.target.value as UserRole)}
                      className="rounded border border-slate-700 bg-[#080B12] px-2.5 py-1 text-xs font-mono text-slate-100 disabled:opacity-50"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={isPrimaryAdmin || isSelf}
                      onClick={() => void handleToggleActive(u)}
                      className={`rounded border px-2.5 py-1 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        u.isActive
                          ? 'border-emerald-500/40 text-emerald-300'
                          : 'border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
