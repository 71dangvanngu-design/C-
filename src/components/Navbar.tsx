import { useState } from 'react';
import { ChevronDown, LogOut, Menu, Shield, User as UserIcon, X } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { hasAdminAccess } from '../lib/authPolicy';

export function Navbar() {
  const { user, siteData, currentPath, navigate, logout } = useHub();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const siteName = siteData?.settings.siteName || 'DIGITAL KNOWLEDGE HUB';
  const tabs = (siteData?.headerTabs ?? []).filter((tab) => {
    if (tab.href === '/cpp-lab' && siteData && !siteData.settings.enableCppLab) {
      return false;
    }
    return true;
  });

  const isAdmin = hasAdminAccess(user);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileOpen(false);
    navigate(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#080B12]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => handleLinkClick(e, '/')}
          className="font-display text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0 hover:text-cyan-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-sm"
        >
          {siteName}
        </a>

        {/* Zone 2: Dynamic Single-Line Nav Tabs */}
        <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6">
          {tabs.slice(0, 5).map((tab) => {
            const active =
              currentPath === tab.href ||
              (tab.href !== '/' && currentPath.startsWith(tab.href));
            return (
              <a
                key={tab.id}
                href={tab.href}
                onClick={(e) => handleLinkClick(e, tab.href)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors py-1 border-b-2 ${
                  active
                    ? 'text-cyan-300 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-100 hover:border-slate-700'
                }`}
              >
                {tab.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {!user ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hidden md:inline-flex items-center justify-center rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold tracking-wide text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              LOGIN
            </button>
          ) : (
            <div className="relative hidden md:block">
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#111827] px-4 py-2 text-xs font-semibold text-slate-100 hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                {isAdmin ? (
                  <Shield className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                )}
                <span className="max-w-[140px] truncate">{user.username}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-800 bg-[#0F172A] py-1.5 shadow-xl"
                >
                  <div className="px-3.5 py-2 border-b border-slate-800/80">
                    <p className="text-xs font-semibold text-slate-100 truncate">{user.username}</p>
                    <p className="text-xs text-slate-400 truncate">{user.accountType}</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/admin');
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-cyan-300 hover:bg-slate-800/70 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>ADMIN CONTROL PANEL</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/account');
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-200 hover:bg-slate-800/70 cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                    <span>Account &amp; Password</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-400 hover:bg-slate-800/70 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex md:hidden items-center justify-center rounded-md border border-slate-800 p-2.5 text-slate-200 hover:bg-slate-800/60"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="md:hidden border-t border-slate-800 bg-[#0B0F19] px-6 py-4 space-y-3">
          <nav aria-label="Mobile Navigation" className="flex flex-col space-y-2">
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={tab.href}
                onClick={(e) => handleLinkClick(e, tab.href)}
                className="py-2 text-sm font-medium text-slate-200 hover:text-cyan-300"
              >
                {tab.label}
              </a>
            ))}
          </nav>
          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            {!user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  navigate('/login');
                }}
                className="w-full rounded-md bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-slate-950"
              >
                LOGIN
              </button>
            ) : (
              <>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate('/admin');
                    }}
                    className="w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-300 text-left"
                  >
                    ADMIN CONTROL PANEL
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate('/account');
                  }}
                  className="w-full rounded-md border border-slate-700 px-4 py-2.5 text-xs font-medium text-slate-200 text-left"
                >
                  Account ({user.username})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    void logout();
                  }}
                  className="w-full rounded-md border border-rose-500/30 px-4 py-2.5 text-xs font-medium text-rose-400 text-left"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
