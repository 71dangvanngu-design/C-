import { useEffect, useState } from 'react';
import { Play, RotateCcw, Terminal } from 'lucide-react';
import { useHub } from '../context/HubContext';
import { CPP_LAB_PRESETS, executeCppSimulation, type CppExecutionResult } from '../lib/cppRunner';

export function CppLabPage() {
  const { siteData, labStarterCode, setLabStarterCode, navigate } = useHub();
  const [selectedPresetId, setSelectedPresetId] = useState(CPP_LAB_PRESETS[0].id);
  const [code, setCode] = useState(() => labStarterCode || CPP_LAB_PRESETS[0].code);
  const [stdin, setStdin] = useState(() => (labStarterCode ? '' : CPP_LAB_PRESETS[0].stdin));
  const [result, setResult] = useState<CppExecutionResult | null>(null);

  useEffect(() => {
    if (labStarterCode) {
      setCode(labStarterCode);
      setStdin('');
      setResult(null);
      setLabStarterCode(null);
    }
  }, [labStarterCode, setLabStarterCode]);

  if (siteData && !siteData.settings.enableCppLab) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-100">
          C++ CODE LAB is Currently Disabled
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          An administrator has disabled this component in Website Settings.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-6 rounded-md bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 cursor-pointer"
        >
          Return Home
        </button>
      </main>
    );
  }

  const handleSelectPreset = (presetId: string) => {
    const preset = CPP_LAB_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setCode(preset.code);
    setStdin(preset.stdin);
    setResult(null);
  };

  const handleRun = () => {
    const res = executeCppSimulation(code, stdin);
    setResult(res);
  };

  const handleReset = () => {
    const preset = CPP_LAB_PRESETS.find((p) => p.id === selectedPresetId) ?? CPP_LAB_PRESETS[0];
    setCode(preset.code);
    setStdin(preset.stdin);
    setResult(null);
  };

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <p className="text-xs font-mono tracking-wider text-cyan-400 mb-1">
            Interactive Execution Sandbox
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-100">
            C++ CODE LAB
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CPP_LAB_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedPresetId === preset.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#0D1320] text-slate-300 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Code Editor */}
        <section className="lg:col-span-7 flex flex-col rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
            <label htmlFor="cpp-editor" className="text-xs font-mono text-slate-300">
              main.cpp
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleRun}
                className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Run Code</span>
              </button>
            </div>
          </div>
          <textarea
            id="cpp-editor"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={18}
            className="w-full flex-1 bg-[#080B12] p-4 font-mono text-xs sm:text-sm text-cyan-100 leading-relaxed focus:outline-none resize-y"
          />
        </section>

        {/* Right: Stdin + Output */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-slate-800 bg-[#0D1320] overflow-hidden">
            <div className="border-b border-slate-800 px-4 py-3">
              <label htmlFor="cpp-stdin" className="text-xs font-mono text-slate-300">
                Standard Input (stdin)
              </label>
            </div>
            <textarea
              id="cpp-stdin"
              spellCheck={false}
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              rows={3}
              placeholder="Space-separated input tokens (e.g. 42)"
              className="w-full bg-[#080B12] p-4 font-mono text-xs sm:text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          <div className="flex-1 rounded-xl border border-slate-800 bg-[#0D1320] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" aria-hidden="true" />
                <span className="text-xs font-mono text-slate-300">Execution Output</span>
              </div>
              {result ? (
                <span
                  className={`text-xs font-mono tabular-nums ${
                    result.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {result.success ? `Exit ${result.exitCode}` : 'Compile/Runtime Error'} ·{' '}
                  {result.executionMs} ms
                </span>
              ) : null}
            </div>
            <pre
              data-testid="cpp-output"
              className="flex-1 min-h-[240px] bg-[#080B12] p-4 font-mono text-xs sm:text-sm whitespace-pre-wrap text-slate-200 overflow-auto"
            >
              {!result
                ? 'Click "Run Code" to execute your C++ program.'
                : result.success
                ? result.stdout || '(Program exited with 0 and no stdout output)'
                : result.stderr}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
