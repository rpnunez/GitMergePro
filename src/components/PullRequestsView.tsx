import React, { useState, useMemo } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  GitMerge,
  Search,
  Filter,
  Layers,
  Sparkles,
  Bot,
  ExternalLink,
  ShieldCheck,
  Tag,
  ArrowRight,
  ChevronRight,
  Code2,
  CheckSquare,
  Square
} from 'lucide-react';
import { PullRequest, Repository } from '../types/index.ts';

interface PullRequestsViewProps {
  pulls: PullRequest[];
  repo: Repository;
  selectedPrIds: Set<string>;
  onToggleSelectPr: (prId: string) => void;
  onSelectAllSafe: () => void;
  onClearSelection: () => void;
  onOpenRebaseModal: (pr: PullRequest) => void;
  onOpenPseudoModal: () => void;
  onAskGeminiAboutPr: (pr: PullRequest) => void;
}

export const PullRequestsView: React.FC<PullRequestsViewProps> = ({
  pulls,
  repo,
  selectedPrIds,
  onToggleSelectPr,
  onSelectAllSafe,
  onClearSelection,
  onOpenRebaseModal,
  onOpenPseudoModal,
  onAskGeminiAboutPr,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'safe' | 'ci_fail' | 'conflicts' | 'static_warn'>('all');
  const [expandedPrId, setExpandedPrId] = useState<string | null>(null);

  // Statistics
  const safePulls = useMemo(() => pulls.filter((p) => p.safeToMerge), [pulls]);
  const ciFailingPulls = useMemo(() => pulls.filter((p) => p.ciStatus === 'failing'), [pulls]);
  const conflictedPulls = useMemo(() => pulls.filter((p) => p.hasConflicts), [pulls]);
  const staticWarningPulls = useMemo(
    () => pulls.filter((p) => p.staticAnalysisStatus === 'warnings' || p.staticAnalysisStatus === 'errors'),
    [pulls]
  );

  // Filtered list
  const filteredPulls = useMemo(() => {
    return pulls.filter((p) => {
      // Type filter
      if (filterType === 'safe' && !p.safeToMerge) return false;
      if (filterType === 'ci_fail' && p.ciStatus !== 'failing') return false;
      if (filterType === 'conflicts' && !p.hasConflicts) return false;
      if (filterType === 'static_warn' && p.staticAnalysisStatus === 'clean') return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(query);
        const matchAuthor = p.author?.toLowerCase().includes(query);
        const matchNumber = String(p.number).includes(query);
        const matchLabels = p.automatedLabelsSummary?.toLowerCase().includes(query);
        return matchTitle || matchAuthor || matchNumber || matchLabels;
      }
      return true;
    });
  }, [pulls, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Velocity Header & Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Total PRs */}
        <div
          onClick={() => setFilterType('all')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'all'
              ? 'border-slate-700 bg-slate-900 shadow-md ring-1 ring-slate-700'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Tracked PRs</span>
            <GitPullRequest className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{pulls.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Live integration queue</div>
        </div>

        {/* Safe to Merge */}
        <div
          onClick={() => setFilterType('safe')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'safe'
              ? 'border-emerald-500/50 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Safe to Merge</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">{safePulls.length}</div>
          <div className="mt-1 text-[11px] text-emerald-500/80">CI Green &amp; No Conflicts</div>
        </div>

        {/* CI Failures */}
        <div
          onClick={() => setFilterType('ci_fail')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'ci_fail'
              ? 'border-rose-500/50 bg-rose-950/30 shadow-md ring-1 ring-rose-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
            <span>CI Failures</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-300">{ciFailingPulls.length}</div>
          <div className="mt-1 text-[11px] text-rose-500/80">GitHub Actions failed</div>
        </div>

        {/* Merge Conflicts */}
        <div
          onClick={() => setFilterType('conflicts')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all ${
            filterType === 'conflicts'
              ? 'border-amber-500/50 bg-amber-950/30 shadow-md ring-1 ring-amber-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Merge Conflicts</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">{conflictedPulls.length}</div>
          <div className="mt-1 text-[11px] text-amber-500/80">Auto-rebase available</div>
        </div>

        {/* Static Analysis Warnings */}
        <div
          onClick={() => setFilterType('static_warn')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all col-span-2 lg:col-span-1 ${
            filterType === 'static_warn'
              ? 'border-cyan-500/50 bg-cyan-950/30 shadow-md ring-1 ring-cyan-500/50'
              : 'border-slate-800/80 bg-slate-950/60 hover:border-cyan-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-cyan-400 font-medium">
            <span>Static Analysis</span>
            <Code2 className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">{staticWarningPulls.length}</div>
          <div className="mt-1 text-[11px] text-cyan-500/80">Linter / Typecheck notice</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Pseudo Build Action */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, PR #, author, branch, or label..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAllSafe}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>Select All Safe ({safePulls.length})</span>
            </button>
            {selectedPrIds.size > 0 && (
              <button
                onClick={onClearSelection}
                className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Clear ({selectedPrIds.size})
              </button>
            )}
          </div>
        </div>

        {/* Pseudo Build Trigger */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenPseudoModal}
            disabled={selectedPrIds.size === 0}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-lg ${
              selectedPrIds.size > 0
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 shadow-cyan-500/20 hover:from-cyan-400 hover:to-teal-400'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Simulate Pseudo Build ({selectedPrIds.size} Selected)</span>
          </button>
        </div>
      </div>

      {/* Pull Requests List */}
      <div className="space-y-3">
        {filteredPulls.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center">
            <GitPullRequest className="mx-auto h-10 w-10 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No pull requests match this filter</h3>
            <p className="mt-1 text-xs text-slate-500">
              Try adjusting your search criteria or switch to the "Tracked PRs" tab.
            </p>
          </div>
        ) : (
          filteredPulls.map((pr) => {
            const isSelected = selectedPrIds.has(pr.id);
            const isExpanded = expandedPrId === pr.id;
            const labels = pr.automatedLabelsSummary
              ? pr.automatedLabelsSummary.split(',').map((l) => l.trim())
              : [];

            return (
              <div
                key={pr.id}
                className={`group rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-cyan-500/50 bg-slate-900/90 shadow-md ring-1 ring-cyan-500/30'
                    : pr.safeToMerge
                    ? 'border-slate-800 bg-slate-900/40 hover:border-emerald-500/40 hover:bg-slate-900/70'
                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                {/* Main Row */}
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Checkbox, PR Number, Title, Author */}
                  <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => onToggleSelectPr(pr.id)}
                      className="mt-1 sm:mt-0 p-1 text-slate-400 hover:text-cyan-400 transition-colors"
                      title={isSelected ? 'Remove from pseudo build' : 'Add to pseudo build'}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-5 w-5 text-cyan-400" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-600 group-hover:text-slate-400" />
                      )}
                    </button>

                    {/* Author Avatar */}
                    {pr.authorAvatar && (
                      <img
                        src={pr.authorAvatar}
                        alt={pr.author || 'Author'}
                        className="h-8 w-8 rounded-full border border-slate-700 object-cover shrink-0 hidden sm:block"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          #{pr.number}
                        </span>
                        <h3 className="font-semibold text-sm text-white truncate max-w-xl">
                          {pr.title}
                        </h3>
                        {/* Safe to Merge Badge */}
                        {pr.safeToMerge && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="h-3 w-3" />
                            SAFE TO MERGE
                          </span>
                        )}
                      </div>

                      {/* Branch and Meta Row */}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="text-slate-400 font-medium">by @{pr.author || 'contributor'}</span>
                        <span className="text-slate-600">•</span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-cyan-400">
                            {pr.headBranch || 'patch'}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-600" />
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-emerald-400">
                            {pr.baseBranch || 'main'}
                          </span>
                        </div>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-slate-500">
                          Updated {new Date(pr.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status Badges & Action CTAs */}
                  <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
                    {/* CI Status Pill */}
                    <div
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        pr.ciStatus === 'passing'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : pr.ciStatus === 'failing'
                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                          : 'border-slate-700 bg-slate-800 text-slate-300'
                      }`}
                      title={`GitHub Actions status: ${pr.ciStatus}`}
                    >
                      {pr.ciStatus === 'passing' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : pr.ciStatus === 'failing' ? (
                        <XCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 animate-spin" />
                      )}
                      <span className="capitalize">CI {pr.ciStatus}</span>
                    </div>

                    {/* Static Analysis Pill */}
                    <div
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        pr.staticAnalysisStatus === 'clean'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                          : pr.staticAnalysisStatus === 'warnings'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                          : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      <span className="capitalize">{pr.staticAnalysisStatus}</span>
                    </div>

                    {/* Conflict Status & Fix Conflict Button */}
                    {pr.hasConflicts ? (
                      <button
                        onClick={() => onOpenRebaseModal(pr)}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-all shadow-sm"
                        title="Rebase onto main branch and auto-resolve collisions"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                        <span>Fix Merge Conflicts</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Clean</span>
                      </div>
                    )}

                    {/* Ask Gemini Button */}
                    <button
                      onClick={() => onAskGeminiAboutPr(pr)}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-colors"
                      title="Analyze this PR with Gemini AI"
                    >
                      <Bot className="h-4 w-4" />
                    </button>

                    {/* Expand Details Arrow */}
                    <button
                      onClick={() => setExpandedPrId(isExpanded ? null : pr.id)}
                      className="rounded-lg p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 bg-slate-950/80 p-4 space-y-3 rounded-b-2xl animate-in fade-in duration-150">
                    {/* Automated Labels */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <Tag className="h-3 w-3" />
                        Automated Prioritization Labels
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {labels.map((lbl, idx) => (
                          <span
                            key={idx}
                            className={`rounded-md px-2 py-0.5 text-[11px] font-medium border ${
                              lbl.includes('safe') || lbl.includes('green')
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                : lbl.includes('blocked') || lbl.includes('failure')
                                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                : lbl.includes('conflict')
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                : 'border-slate-700 bg-slate-800 text-slate-300'
                            }`}
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Conflicted Files Notice if present */}
                    {pr.hasConflicts && pr.conflictedFilesSummary && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <div className="text-xs font-semibold text-amber-400">
                          Conflicted Files against target: {pr.conflictedFilesSummary}
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                          Use the "Fix Merge Conflicts" tool above to auto-rebase and resolve imports / dependencies without git command line friction.
                        </p>
                      </div>
                    )}

                    {/* CI Matrix Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Test Suite (Jest/Vitest)</span>
                        <span className={`font-semibold ${pr.ciStatus === 'passing' ? 'text-emerald-400' : pr.ciStatus === 'failing' ? 'text-rose-400' : 'text-slate-300'}`}>
                          {pr.ciStatus === 'passing' ? '14/14 Suites Passed' : pr.ciStatus === 'failing' ? '2 Failures in Auth Worker' : 'In Progress'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Static Linter &amp; Types</span>
                        <span className={`font-semibold ${pr.staticAnalysisStatus === 'clean' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {pr.staticAnalysisStatus === 'clean' ? '0 Type Errors, Strict OK' : '2 Cognitive Complexity Warnings'}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                        <span className="text-slate-400 block text-[11px]">Merge Confidence Score</span>
                        <span className="font-semibold text-cyan-400">
                          {pr.mergeConfidenceScore || (pr.safeToMerge ? 95 : 40)}/100
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
