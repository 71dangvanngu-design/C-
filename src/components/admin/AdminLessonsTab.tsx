import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Category, Lesson, LessonStatus } from '../../types/hub';

interface AdminLessonsTabProps {
  lessons: Lesson[];
  categories: Category[];
  onChanged: () => Promise<void>;
  onError: (msg: string) => void;
}

export function AdminLessonsTab({
  lessons,
  categories,
  onChanged,
  onError,
}: AdminLessonsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [cppStarter, setCppStarter] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [readMinutes, setReadMinutes] = useState(8);
  const [status, setStatus] = useState<LessonStatus>('published');
  const [saving, setSaving] = useState(false);

  // Category creation state
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setCppStarter(
      `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello Digital Knowledge Hub" << endl;\n    return 0;\n}`
    );
    setCategoryId(categories[0]?.id ?? '');
    setLevel('Intermediate');
    setReadMinutes(8);
    setStatus('published');
    setShowForm(true);
  };

  const openEdit = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setTitle(lesson.title);
    setSummary(lesson.summary);
    setContent(lesson.content);
    setCppStarter(lesson.cppStarter);
    setCategoryId(lesson.categoryId);
    setLevel(lesson.level);
    setReadMinutes(lesson.readMinutes);
    setStatus(lesson.status);
    setShowForm(true);
  };

  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/lessons/${editingId}` : '/api/admin/lessons';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          summary,
          content,
          cppStarter,
          categoryId: categoryId || categories[0]?.id,
          level,
          readMinutes: Number(readMinutes),
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'Failed to save lesson.');
        return;
      }
      setShowForm(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (lesson: Lesson) => {
    const nextStatus: LessonStatus = lesson.status === 'published' ? 'hidden' : 'published';
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to update lesson status.');
      return;
    }
    await onChanged();
  };

  const handleDeleteLesson = async (lesson: Lesson) => {
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to delete lesson.');
      return;
    }
    await onChanged();
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: catName, description: catDesc }),
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to create category.');
      return;
    }
    setCatName('');
    setCatDesc('');
    await onChanged();
  };

  const handleDeleteCategory = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const d = await res.json();
      onError(d.error || 'Failed to delete category.');
      return;
    }
    await onChanged();
  };

  return (
    <div className="space-y-8">
      {/* Lessons Section */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-100">
              Lessons Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, edit, publish, hide, or remove curriculum modules.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Create Lesson</span>
          </button>
        </div>

        {showForm ? (
          <form
            onSubmit={handleSaveLesson}
            className="mb-8 rounded-lg border border-cyan-500/30 bg-[#080B12] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-cyan-300">
                {editingId ? 'Edit Lesson' : 'New Lesson'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="lesson-title" className="block text-xs text-slate-300 mb-1">
                  Title
                </label>
                <input
                  id="lesson-title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="lesson-category" className="block text-xs text-slate-300 mb-1">
                  Category
                </label>
                <select
                  id="lesson-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="lesson-summary" className="block text-xs text-slate-300 mb-1">
                Summary
              </label>
              <input
                id="lesson-summary"
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="lesson-level" className="block text-xs text-slate-300 mb-1">
                  Level
                </label>
                <select
                  id="lesson-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')}
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label htmlFor="lesson-minutes" className="block text-xs text-slate-300 mb-1">
                  Read Minutes
                </label>
                <input
                  id="lesson-minutes"
                  type="number"
                  min={1}
                  max={120}
                  value={readMinutes}
                  onChange={(e) => setReadMinutes(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100 font-mono"
                />
              </div>
              <div>
                <label htmlFor="lesson-status" className="block text-xs text-slate-300 mb-1">
                  Publish Status
                </label>
                <select
                  id="lesson-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LessonStatus)}
                  className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
                >
                  <option value="published">Published</option>
                  <option value="hidden">Hidden</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="lesson-content" className="block text-xs text-slate-300 mb-1">
                Lesson Content
              </label>
              <textarea
                id="lesson-content"
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 text-sm text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="lesson-cpp" className="block text-xs text-slate-300 mb-1">
                C++ Code Lab Starter (Optional)
              </label>
              <textarea
                id="lesson-cpp"
                rows={4}
                value={cppStarter}
                onChange={(e) => setCppStarter(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-[#0D1320] px-3 py-2 font-mono text-xs text-cyan-100"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-cyan-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Lesson'}
              </button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Title</th>
                <th className="py-2.5 pr-4 font-medium">Category</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {lessons.map((lesson) => {
                const cat = categories.find((c) => c.id === lesson.categoryId)?.name ?? 'Uncategorized';
                return (
                  <tr key={lesson.id} className="hover:bg-slate-800/30">
                    <td className="py-3 pr-4 font-medium text-slate-100">{lesson.title}</td>
                    <td className="py-3 pr-4 text-xs text-slate-400">{cat}</td>
                    <td className="py-3 pr-4 text-xs font-mono">
                      <span
                        className={
                          lesson.status === 'published'
                            ? 'text-emerald-400'
                            : lesson.status === 'hidden'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                        }
                      >
                        {lesson.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={
                            lesson.status === 'published'
                              ? `Hide ${lesson.title}`
                              : `Publish ${lesson.title}`
                          }
                          onClick={() => void handleToggleStatus(lesson)}
                          className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/50 cursor-pointer inline-flex items-center gap-1"
                        >
                          {lesson.status === 'published' ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Hide</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Publish</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${lesson.title}`}
                          onClick={() => openEdit(lesson)}
                          className="rounded border border-slate-700 p-1.5 text-slate-300 hover:border-cyan-500/50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${lesson.title}`}
                          onClick={() => void handleDeleteLesson(lesson)}
                          className="rounded border border-slate-700 p-1.5 text-rose-400 hover:border-rose-500/50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Categories Section */}
      <section className="rounded-xl border border-slate-800 bg-[#0D1320] p-6">
        <h2 className="font-display text-lg font-semibold text-slate-100 mb-1">Categories</h2>
        <p className="text-xs text-slate-400 mb-5">
          Create or remove knowledge categories shown in the curriculum filters.
        </p>

        <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            required
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="Category name (e.g. Compilers)"
            aria-label="New category name"
            className="flex-1 rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 text-sm text-slate-100"
          />
          <input
            type="text"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
            placeholder="Short description"
            aria-label="New category description"
            className="flex-1 rounded-md border border-slate-700 bg-[#080B12] px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="submit"
            className="rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            Add Category
          </button>
        </form>

        <div className="divide-y divide-slate-800/70">
          {categories.map((cat) => (
            <div key={cat.id} className="py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-100">{cat.name}</p>
                <p className="text-xs text-slate-400">{cat.description}</p>
              </div>
              <button
                type="button"
                aria-label={`Delete category ${cat.name}`}
                onClick={() => void handleDeleteCategory(cat.id)}
                className="rounded border border-slate-700 px-2.5 py-1.5 text-xs text-rose-400 hover:border-rose-500/50 cursor-pointer"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
