import { useEffect, useState } from 'react';
import { ArrowLeft, Code2 } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { ResilientImage } from '../components/ResilientImage';
import type { Lesson } from '../types/hub';

export function LessonPage({ slug }: { slug: string }) {
  const { siteData, navigate, setLabStarterCode } = useHub();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);

    fetch(`/api/lessons/${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { lesson: Lesson };
        setLesson(data.lesson);
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12 space-y-6">
        <div className="h-8 w-48 rounded bg-slate-800 animate-pulse" />
        <div className="h-72 rounded-xl bg-[#0D1320] border border-slate-800 animate-pulse" />
      </main>
    );
  }

  if (notFound || !lesson) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-100">Lesson Unavailable</h1>
        <p className="mt-2 text-sm text-slate-400">
          This module may have been hidden or removed by an administrator.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Curriculum</span>
        </button>
      </main>
    );
  }

  const categoryName =
    siteData?.categories.find((c) => c.id === lesson.categoryId)?.name ?? 'Engineering';

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-cyan-300 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>Back to DIGITAL KNOWLEDGE HUB</span>
      </button>

      <article className="space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-cyan-400 font-medium">{categoryName}</span>
            <span aria-hidden="true">·</span>
            <span>{lesson.level}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{lesson.readMinutes} min read</span>
          </div>
          <h1
            className="font-display text-3xl sm:text-4xl font-bold text-slate-100 leading-tight"
            style={{ textWrap: 'balance' }}
          >
            {lesson.title}
          </h1>
          <p className="text-base text-slate-300 leading-relaxed max-w-3xl">{lesson.summary}</p>
        </header>

        <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0D1320] h-72 sm:h-80">
          <ResilientImage
            src={lesson.imageUrl}
            alt={lesson.title}
            fallbackTitle={lesson.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="prose prose-invert max-w-none space-y-4 text-slate-300 leading-relaxed text-[15px]">
          {lesson.content.split('\n\n').map((para, idx) => (
            <p key={idx} className="whitespace-pre-line">
              {para}
            </p>
          ))}
        </div>

        {lesson.cppStarter ? (
          <section className="rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3.5">
              <span className="text-xs font-mono font-medium text-slate-300">
                C++ Practice Snippet
              </span>
              {siteData?.settings.enableCppLab ? (
                <button
                  type="button"
                  onClick={() => {
                    setLabStarterCode(lesson.cppStarter);
                    navigate('/cpp-lab');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Open in C++ CODE LAB</span>
                </button>
              ) : null}
            </div>
            <pre className="p-5 overflow-x-auto text-xs sm:text-sm font-mono text-cyan-100 leading-relaxed">
              <code>{lesson.cppStarter}</code>
            </pre>
          </section>
        ) : null}
      </article>
    </main>
  );
}
