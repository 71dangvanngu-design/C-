import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import type { HeaderTab, SiteSection, SiteSettings } from '../../types/hub';

interface AdminSiteStructureTabProps {
  tabs: HeaderTab[];
  sections: SiteSection[];
  settings: SiteSettings;
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function AdminSiteStructureTab({
  tabs,
  sections,
  settings,
  onChanged,
  onError,
  onSuccess,
}: AdminSiteStructureTabProps) {
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabHref, setNewTabHref] = useState('/');
  const [localSections, setLocalSections] = useState<SiteSection[]>(sections);
  const [localSettings, setLocalSettings] = useState<SiteSettings>(settings);

  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleAddTab = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/header-tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ label: newTabLabel, href: newTabHref }),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to add header tab.');
      return;
    }
    setNewTabLabel('');
    setNewTabHref('/');
    onSuccess('Header tab added.');
    await onChanged();
  };

  const handleUpdateTab = async (tab: HeaderTab, patch: Partial<HeaderTab>) => {
    const res = await fetch(`/api/admin/header-tabs/${tab.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to update tab.');
      return;
    }
    await onChanged();
  };

  const handleDeleteTab = async (id: string) => {
    const res = await fetch(`/api/admin/header-tabs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to delete tab.');
      return;
    }
    onSuccess('Header tab deleted.');
    await onChanged();
  };

  const moveTab = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= tabs.length) return;
    const copy = [...tabs];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    const res = await fetch('/api/admin/header-tabs/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ orderedIds: copy.map((t) => t.id) }),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to reorder tabs.');
      return;
    }
    onSuccess('Header tab order saved.');
    await onChanged();
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= localSections.length) return;
    const copy = [...localSections];
    [copy[idx], copy[target]] = [copy[target], copy[idx]];
    setLocalSections(copy);
  };

  const handleSaveSections = async () => {
    const res = await fetch('/api/admin/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sections: localSections }),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to save homepage layout.');
      return;
    }
    onSuccess('Homepage layout and section content saved.');
    await onChanged();
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(localSettings),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to update website components.');
      return;
    }
    onSuccess('Website components and settings saved.');
    await onChanged();
  };

  return (
    <div className="space-y-8">
      {/* Header Tabs Manager */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-1">
          Header Tabs &amp; Ordering
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Add, rename, toggle visibility, or reorder navigation links shown in the top bar.
        </p>

        <form onSubmit={handleAddTab} className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            required
            value={newTabLabel}
            onChange={(e) => setNewTabLabel(e.target.value)}
            placeholder="Tab label (e.g. Algorithms)"
            aria-label="New header tab label"
            className="flex-1 rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 text-sm text-slate-100"
          />
          <input
            type="text"
            required
            value={newTabHref}
            onChange={(e) => setNewTabHref(e.target.value)}
            placeholder="Target path (e.g. /#catalog or /cpp-lab)"
            aria-label="New header tab URL"
            className="flex-1 rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 font-mono text-xs text-slate-100"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Add Tab</span>
          </button>
        </form>

        <div className="divide-y divide-slate-800/70">
          {tabs.map((tab, idx) => (
            <div key={tab.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-slate-500 tabular-nums w-5">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  defaultValue={tab.label}
                  aria-label={`Edit label for ${tab.label}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== tab.label) {
                      void handleUpdateTab(tab, { label: e.target.value.trim() });
                    }
                  }}
                  className="rounded border border-slate-800 bg-[#080B12] px-2.5 py-1 text-sm text-slate-100 w-36"
                />
                <input
                  type="text"
                  defaultValue={tab.href}
                  aria-label={`Edit URL for ${tab.label}`}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== tab.href) {
                      void handleUpdateTab(tab, { href: e.target.value.trim() });
                    }
                  }}
                  className="rounded border border-slate-800 bg-[#080B12] px-2.5 py-1 font-mono text-xs text-slate-300 w-44"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={`Move ${tab.label} up`}
                  disabled={idx === 0}
                  onClick={() => void moveTab(idx, -1)}
                  className="rounded border border-slate-700 p-1.5 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${tab.label} down`}
                  disabled={idx === tabs.length - 1}
                  onClick={() => void moveTab(idx, 1)}
                  className="rounded border border-slate-700 p-1.5 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdateTab(tab, { isVisible: !tab.isVisible })}
                  className={`rounded border px-2.5 py-1 text-xs cursor-pointer ${
                    tab.isVisible
                      ? 'border-emerald-500/40 text-emerald-300'
                      : 'border-slate-700 text-slate-400'
                  }`}
                >
                  {tab.isVisible ? 'Visible' : 'Hidden'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete tab ${tab.label}`}
                  onClick={() => void handleDeleteTab(tab.id)}
                  className="rounded border border-slate-700 p-1.5 text-rose-400 hover:border-rose-500/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Homepage Layout & Content Sections */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Homepage Layout &amp; Section Content
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reorder homepage regions, toggle visibility, and customize headlines or copy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSections()}
            className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Layout</span>
          </button>
        </div>

        <div className="space-y-4">
          {localSections.map((sec, idx) => (
            <div
              key={sec.id}
              className="rounded-lg border border-slate-800 bg-[#080B12] p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-cyan-400">
                  #{idx + 1} · {sec.sectionType}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Move section ${sec.title} up`}
                    disabled={idx === 0}
                    onClick={() => moveSection(idx, -1)}
                    className="rounded border border-slate-700 p-1 text-slate-300 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move section ${sec.title} down`}
                    disabled={idx === localSections.length - 1}
                    onClick={() => moveSection(idx, 1)}
                    className="rounded border border-slate-700 p-1 text-slate-300 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalSections((prev) =>
                        prev.map((s) =>
                          s.id === sec.id ? { ...s, isVisible: !s.isVisible } : s
                        )
                      )
                    }
                    className={`rounded border px-2.5 py-1 text-xs cursor-pointer ${
                      sec.isVisible
                        ? 'border-emerald-500/40 text-emerald-300'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {sec.isVisible ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Section Title</label>
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) =>
                      setLocalSections((prev) =>
                        prev.map((s) => (s.id === sec.id ? { ...s, title: e.target.value } : s))
                      )
                    }
                    className="w-full rounded border border-slate-700 bg-[#0D1320] px-3 py-1.5 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Subtitle</label>
                  <input
                    type="text"
                    value={sec.subtitle}
                    onChange={(e) =>
                      setLocalSections((prev) =>
                        prev.map((s) => (s.id === sec.id ? { ...s, subtitle: e.target.value } : s))
                      )
                    }
                    className="w-full rounded border border-slate-700 bg-[#0D1320] px-3 py-1.5 text-sm text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Body Copy</label>
                <textarea
                  rows={2}
                  value={sec.body}
                  onChange={(e) =>
                    setLocalSections((prev) =>
                      prev.map((s) => (s.id === sec.id ? { ...s, body: e.target.value } : s))
                    )
                  }
                  className="w-full rounded border border-slate-700 bg-[#0D1320] px-3 py-1.5 text-sm text-slate-100"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Global Website Components */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-1">
          Website Components &amp; Global Settings
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Control global branding, footer copy, and core platform modules.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-4 max-w-2xl">
          <div>
            <label htmlFor="site-name" className="block text-xs text-slate-300 mb-1">
              Website Brand Title
            </label>
            <input
              id="site-name"
              type="text"
              value={localSettings.siteName}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, siteName: e.target.value }))
              }
              className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="site-footer" className="block text-xs text-slate-300 mb-1">
              Footer Text
            </label>
            <input
              id="site-footer"
              type="text"
              value={localSettings.footerNote}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, footerNote: e.target.value }))
              }
              className="w-full rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div className="space-y-2.5 pt-2">
            <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableCppLab}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, enableCppLab: e.target.checked }))
                }
                className="h-4 w-4 accent-cyan-500"
              />
              <span>Enable C++ CODE LAB Interactive Module</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableSearch}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, enableSearch: e.target.checked }))
                }
                className="h-4 w-4 accent-cyan-500"
              />
              <span>Enable Lesson Search Bar</span>
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.enableRegistration}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    enableRegistration: e.target.checked,
                  }))
                }
                className="h-4 w-4 accent-cyan-500"
              />
              <span>Allow Public User Registration</span>
            </label>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Component Settings</span>
          </button>
        </form>
      </section>
    </div>
  );
}
