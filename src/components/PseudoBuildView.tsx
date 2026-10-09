import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Save,
  Trash2,
  GitMerge,
  FileCode,
  ArrowRight,
  ShieldCheck,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';
import { PullRequest, PseudoBuild, Repository } from '../types/index.ts';

interface PseudoBuildViewProps {
  pulls: PullRequest[];
  repo: Repository;
  selectedPrIds: Set<string>;
  onToggleSelectPr: (prId: string) => void;
  savedBuilds: PseudoBuild[];
  onSaveBuild: (build: PseudoBuild) => Promise<void>;
  onDeleteBuild: (buildId: string) => Promise<void>;
  userId: string;
}

export const PseudoBuildView: React.FC<PseudoBuildViewProps> = ({
  pulls,
  repo,
  selectedPrIds,
  onToggleSelectPr,
  savedBuilds,
  onSaveBuild,
  onDeleteBuild,
  userId,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [buildTitle, setBuildTitle] = useState('Release Train Batch #1');
  const [isSaving, setIsSaving] = useState(false);

  const selectedPrList = pulls.filter((p) => selectedPrIds.has(p.id));

  const handleRunSimulation = async () => {
    if (selectedPrList.length === 0) return;
    setIsSimulating(true);
    try {
      const response = await fetch('/api/pseudo-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: `${repo.owner}/${repo.repo}`,
          selectedPrs: selectedPrList,
          targetBranch: repo.defaultBranch || 'main',
        }),
      });

      const data = await response.json();
      setSimulationResult(data);
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!simulationResult) return;
    setIsSaving(true);
    try {
      const newBuild: PseudoBuild = {
        id: `build-${Date.now()}`,
        userId,
        repoId: repo.id,
        title: buildTitle || `Batch Simulation (${selectedPrList.length} PRs)`,
        selectedPrNumbers: selectedPrList.map((p) => `#${p.number}`).join(', '),
        canMergeAll: simulationResult.canMergeAll ?? true,
        riskLevel: simulationResult.riskLevel || 'LOW',
        summary: simulationResult.summary || 'Simulation completed without conflicts.',
        createdAt: new Date().toISOString(),
      };

      await onSaveBuild(newBuild);
    } catch (err) {
      console.error('Failed to save pseudo build:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Simulation Workspace Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-500 text-slate-950 shadow-lg shadow-cyan-500/20 font-bold">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pseudo Build Simulator</h2>
              <p className="text-xs text-slate-400">
                Simulate merging multiple candidate PRs concurrently to detect file collisions &amp; CI train risks before deploying to {repo.defaultBranch || 'main'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={buildTitle}
              onChange={(e) => setBuildTitle(e.target.value)}
              placeholder="Name this pseudo build..."
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={handleRunSimulation}
              disabled={selectedPrList.length === 0 || isSimulating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:from-cyan-400 hover:to-teal-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {isSimulating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Simulating Composite Merge...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Run Pseudo Build ({selectedPrList.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selected PR Tray */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              PRs Included in Merge Train ({selectedPrList.length} of {pulls.length})
            </span>
            <span className="text-slate-500">Check/uncheck PRs below to customize the train</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {pulls.map((pr) => {
              const isSelected = selectedPrIds.has(pr.id);
              return (
                <div
                  key={pr.id}
                  onClick={() => onToggleSelectPr(pr.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-500/40 bg-cyan-950/20 text-white'
                      : 'border-slate-800/80 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-cyan-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600 shrink-0" />
                    )}
                    <span className="font-mono text-xs text-slate-300 font-semibold shrink-0">
                      #{pr.number}
                    </span>
                    <span className="text-xs truncate">{pr.title}</span>
                  </div>
                  <span
                    className={`text-[10px] rounded px-1.5 py-0.5 font-bold uppercase shrink-0 ${
                      pr.safeToMerge
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {pr.safeToMerge ? 'Safe' : 'Risk'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-950 p-5 animate-in fade-in duration-200">
            {/* Verdict Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${
                    simulationResult.canMergeAll
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {simulationResult.canMergeAll ? (
                    <ShieldCheck className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {simulationResult.canMergeAll
                      ? 'Pseudo Build Passed: Safe for Composite Merge'
                      : 'Pseudo Build Warning: File Collisions Detected'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Evaluated compatibility matrix across {selectedPrList.length} pull requests.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase border ${
                    simulationResult.riskLevel === 'LOW'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : simulationResult.riskLevel === 'MEDIUM'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  Risk: {simulationResult.riskLevel || 'LOW'}
                </span>
                <button
                  onClick={handleSaveToHistory}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-cyan-400" />}
                  <span>Save to DB</span>
                </button>
              </div>
            </div>

            {/* Merge Order Sequence */}
            {simulationResult.mergeOrder && simulationResult.mergeOrder.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Recommended Sequential Merge Order
                </span>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {simulationResult.mergeOrder.map((prNum: number, idx: number) => (
                    <React.Fragment key={idx}>
                      <span className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 font-mono font-bold text-cyan-300">
                        <span>Step {idx + 1}:</span>
                        <span>PR #{prNum}</span>
                      </span>
                      {idx < simulationResult.mergeOrder.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-slate-600" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* Collisions Report */}
            {simulationResult.collisionsFound && simulationResult.collisionsFound.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                <span className="text-xs font-semibold text-amber-400 block mb-2">
                  Inter-PR Overlapping File Collisions
                </span>
                <div className="space-y-1.5">
                  {simulationResult.collisionsFound.map((col: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/80 p-2 rounded-lg">
                      <span className="flex items-center gap-1.5 text-amber-300">
                        <FileCode className="h-3.5 w-3.5" />
                        {col.file}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        PRs involved: {col.prsInvolved?.map((p: any) => `#${p}`).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed AI / Engine Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Mergability Analysis Report
              </span>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                {simulationResult.summary}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Saved Pseudo Builds History */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h3 className="text-base font-bold text-white mb-1">Saved Pseudo Build History</h3>
        <p className="text-xs text-slate-400 mb-4">
          Historical multi-PR train merge simulations persisted in Firestore.
        </p>

        {savedBuilds.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-xs text-slate-500">
            No saved pseudo builds yet. Run a simulation above and click "Save to DB".
          </div>
        ) : (
          <div className="space-y-3">
            {savedBuilds.map((build) => (
              <div
                key={build.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{build.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                        build.canMergeAll
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {build.riskLevel} RISK
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">PRs:</span> {build.selectedPrNumbers}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{build.summary}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-500">
                    {new Date(build.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => onDeleteBuild(build.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
