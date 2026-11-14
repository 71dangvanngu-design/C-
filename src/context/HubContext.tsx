import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PublicSitePayload, UserProfile } from '../types/hub';

interface HubContextValue {
  user: UserProfile | null;
  authLoading: boolean;
  siteData: PublicSitePayload | null;
  siteLoading: boolean;
  currentPath: string;
  labStarterCode: string | null;
  setLabStarterCode: (code: string | null) => void;
  navigate: (to: string) => void;
  refreshAuth: () => Promise<UserProfile | null>;
  refreshSite: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }>;
  register: (email: string, username: string, password: string) => Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ ok: true; user: UserProfile } | { ok: false; error: string }>;
  forgotPassword: (identifier: string) => Promise<{ ok: boolean; message: string }>;
}

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [siteData, setSiteData] = useState<PublicSitePayload | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname + window.location.hash);
  const [labStarterCode, setLabStarterCode] = useState<string | null>(null);

  const navigate = useCallback((to: string) => {
    const [pathPart, hashPart] = to.split('#');
    const targetPath = pathPart || '/';
    const fullUrl = hashPart ? `${targetPath}#${hashPart}` : targetPath;
    if (window.location.pathname + window.location.hash !== fullUrl) {
      window.history.pushState({}, '', fullUrl);
    }
    setCurrentPath(fullUrl);
    if (hashPart) {
      setTimeout(() => {
        const el = document.getElementById(hashPart);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  useEffect(() => {
    const handlePop = () => {
      setCurrentPath(window.location.pathname + window.location.hash);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const refreshAuth = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = (await res.json()) as { user: UserProfile | null };
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const refreshSite = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/site', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as PublicSitePayload;
        setSiteData(data);
      }
    } finally {
      setSiteLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
    void refreshSite();
  }, [refreshAuth, refreshSite]);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: data.error || 'LOGIN FAILED' };
      }
      setUser(data.user);
      return { ok: true as const, user: data.user as UserProfile };
    } catch {
      return { ok: false as const, error: 'LOGIN FAILED' };
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: data.error || 'Registration failed.' };
      }
      setUser(data.user);
      return { ok: true as const, user: data.user as UserProfile };
    } catch {
      return { ok: false as const, error: 'Network error during registration.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    navigate('/');
  }, [navigate]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false as const, error: data.error || 'Failed to update password.' };
      }
      setUser(data.user);
      return { ok: true as const, user: data.user as UserProfile };
    } catch {
      return { ok: false as const, error: 'Network error updating password.' };
    }
  }, []);

  const forgotPassword = useCallback(async (identifier: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      return {
        ok: res.ok,
        message:
          data.message ||
          data.error ||
          'If a matching account exists, recovery instructions have been dispatched.',
      };
    } catch {
      return { ok: false, message: 'Unable to dispatch recovery request.' };
    }
  }, []);

  return (
    <HubContext.Provider
      value={{
        user,
        authLoading,
        siteData,
        siteLoading,
        currentPath,
        labStarterCode,
        setLabStarterCode,
        navigate,
        refreshAuth,
        refreshSite,
        login,
        register,
        logout,
        changePassword,
        forgotPassword,
      }}
    >
      {children}
    </HubContext.Provider>
  );
}

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}
