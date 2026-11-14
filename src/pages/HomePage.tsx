import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Code2, LockKeyhole, Search, Terminal } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ResilientImage } from '../components/ResilientImage';
import type { SiteSection } from '../types/hub';

export function HomePage() {
  const { siteData, siteLoading, navigate, setLabStarterCode } = useHub();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const categories = siteData?.categories ?? [];
  const lessons = siteData?.lessons ?? [];
  const sections = siteData?.sections ?? [];
  const settings = siteData?.settings;

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lessons.filter((lesson) => {
      const matchesCategory =
        selectedCategoryId === 'all' || lesson.categoryId === selectedCategoryId;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        lesson.title.toLowerCase().includes(q) ||
        lesson.summary.toLowerCase().includes(q) ||
        (categoryMap.get(lesson.categoryId)?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [lessons, searchQuery, selectedCategoryId, categoryMap]);

  if (siteLoading || !siteData) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 space-y-12">
        <div className="h-80 rounded-xl bg-[#0E1420] border border-slate-800/70 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-xl bg-[#0E1420] border border-slate-800/70 animate-pulse" />
          <div className="h-64 rounded-xl bg-[#0E1420] border border-slate-800/70 animate-pulse" />
          <div className="h-64 rounded-xl bg-[#0E1420] border border-slate-800/70 animate-pulse" />
        </div>
      </main>
    );
  }

  const renderSection = (section: SiteSection) => {
    if (section.sectionType === 'hero') {
      return (
        <section
          key={section.id}
          className="border-b border-slate-800/80 cyber-grid-bg"
        >
          <div className="mx-auto max-w-7xl px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-mono tracking-wider text-cyan-400 mb-3">
                {section.subtitle}
              </p>
              <h1
                className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-50 leading-tight max-w-2xl"
                style={{ textWrap: 'balance' }}
              >
                {section.title}
              </h1>
              <p className="mt-5 text-base text-slate-300 leading-relaxed max-w-2xl">
                {section.body}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate(section.ctaHref || '/cpp-lab')}
                  className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                >
                  <span>{section.ctaLabel || 'Open C++ Code Lab'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <a
                  href="#catalog"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/#catalog');
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-[#111827] px-5 py-3 text-sm font-medium text-slate-200 hover:border-cyan-500/50 transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                  <span>Browse Curriculum</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-5 flex">
              <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-[#0D1320]">
                <ResilientImage
                  src="/src/assets/images/hero_cyber_knowledge_hub_1794627187265.jpg"
                  alt="Digital Knowledge Hub architectural library"
                  fallbackTitle="DIGITAL KNOWLEDGE HUB"
                  className="w-full h-72 lg:h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Full-width 4-column summary strip below hero split */}
          <div className="mx-auto max-w-7xl px-6 pb-12">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-800/80 pt-8">
              <div>
                <p className="text-xs text-slate-400">Published Modules</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                  {lessons.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Knowledge Domains</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-100 tabular-nums">
                  {categories.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Interactive Sandbox</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-cyan-300">
                  {settings?.enableCppLab ? 'C++17 Ready' : 'Disabled'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Security Model</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-slate-100">
                  RLS + RBAC
                </p>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (section.sectionType === 'catalog') {
      return (
        <section id="catalog" key={section.id} className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <p className="text-xs font-mono tracking-wider text-cyan-400 mb-2">
                {section.subtitle}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
                {section.title}
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xl">{section.body}</p>
            </div>

            {settings?.enableSearch ? (
              <div className="relative w-full md:w-80">
                <label htmlFor="lesson-search" className="sr-only">
                  Search lessons
                </label>
                <Search
                  className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="lesson-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search lessons or topics..."
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                />
              </div>
            ) : null}
          </div>

          {/* Interactive Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 mb-8" role="group" aria-label="Category Filter">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategoryId === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              All Modules
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {filteredLessons.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-[#0D1320] p-10 text-center">
              <p className="text-base font-medium text-slate-200">
                No published lessons matched your filter.
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Clear the search query or choose another category to inspect available modules.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('all');
                }}
                className="mt-4 rounded-md border border-slate-700 px-4 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-500/60 cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLessons.map((lesson) => {
                const catName = categoryMap.get(lesson.categoryId) ?? 'General';
                return (
                  <article
                    key={lesson.id}
                    className="flex flex-col rounded-xl border border-slate-800/90 bg-[#0D1320] overflow-hidden hover:border-cyan-500/50 transition-colors"
                  >
                    <div className="h-44 overflow-hidden border-b border-slate-800/80">
                      <ResilientImage
                        src={lesson.imageUrl}
                        alt={lesson.title}
                        fallbackTitle={lesson.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 p-6 flex flex-col">
                      {/* Zero-pill clean text metadata */}
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2.5">
                        <span className="text-cyan-400 font-medium">{catName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{lesson.level}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{lesson.readMinutes} min</span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-slate-100 leading-snug">
                        {lesson.title}
                      </h3>
                      <p className="mt-2.5 text-sm text-slate-400 leading-relaxed flex-1">
                        {lesson.summary}
                      </p>

                      <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/lessons/${lesson.slug}`)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                        >
                          <span>Read Lesson</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        {settings?.enableCppLab && lesson.cppStarter ? (
                          <button
                            type="button"
                            onClick={() => {
                              setLabStarterCode(lesson.cppStarter);
                              navigate('/cpp-lab');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 cursor-pointer"
                          >
                            <Code2 className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                            <span>Run in Lab</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      );
    }

    if (section.sectionType === 'cpp_lab_promo') {
      if (!settings?.enableCppLab) return null;
      return (
        <section key={section.id} className="border-y border-slate-800/80 bg-[#0B101B]">
          <div className="mx-auto max-w-7xl px-6 py-14 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <p className="text-xs font-mono tracking-wider text-cyan-400 mb-2">
                {section.subtitle}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
                {section.title}
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
                {section.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(section.ctaHref || '/cpp-lab')}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Terminal className="w-4 h-4" aria-hidden="true" />
              <span>{section.ctaLabel || 'Launch C++ Code Lab'}</span>
            </button>
          </div>
        </section>
      );
    }

    if (section.sectionType === 'architecture') {
      return (
        <section id="architecture" key={section.id} className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-mono tracking-wider text-cyan-400 mb-2">
              {section.subtitle}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
              {section.title}
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">{section.body}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-6">
              <LockKeyhole className="w-5 h-5 text-cyan-400 mb-3" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                01. Salted Hash &amp; Supabase Auth
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Passwords are never stored in plaintext. Admin initialization runs strictly on the
                backend via Supabase Admin API or scrypt vault.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-6">
              <BookOpen className="w-5 h-5 text-cyan-400 mb-3" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                02. Row-Level Security Policies
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Role checks verify authoritative profile records on every privileged query,
                preventing client-side role spoofing or self-elevation.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1320] p-6">
              <Code2 className="w-5 h-5 text-cyan-400 mb-3" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-slate-100">
                03. Super Admin Governance
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Full lifecycle control over lessons, categories, header tabs, homepage layout, and
                user permissions inside the protected control panel.
              </p>
            </div>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="min-h-[calc(100vh-73px)] flex flex-col">
      <main className="flex-1">{sections.map(renderSection)}</main>
      <footer className="border-t border-slate-800/80 bg-[#070A10]">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>{settings?.footerNote || 'DIGITAL KNOWLEDGE HUB'}</span>
          <div className="flex items-center gap-6">
            <a
              href="/cpp-lab"
              onClick={(e) => {
                e.preventDefault();
                navigate('/cpp-lab');
              }}
              className="hover:text-slate-300"
            >
              C++ Code Lab
            </a>
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
              className="hover:text-slate-300"
            >
              Authentication Portal
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
