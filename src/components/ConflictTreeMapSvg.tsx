import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  FileCode,
  Folder,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  Bot,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code2,
  Sparkles,
  Layers,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  GitPullRequest,
  FileText,
  FileDiff,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { PullRequest, Repository } from '../types/index.ts';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  isConflicted?: boolean;
  fileExt?: string;
  depth: number;
  x?: number;
  y?: number;
}

interface ConflictTreeMapSvgProps {
  pr: PullRequest;
  repo: Repository;
  files: string[];
  onOpenRebaseModal?: (pr: PullRequest) => void;
  onAskGeminiAboutPr?: (pr: PullRequest) => void;
}

interface FileDiffData {
  success: boolean;
  isLiveFromGitHub: boolean;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  rawPatch?: string;
  collisionType: string;
  targetConflictSnippet: string;
  incomingConflictSnippet: string;
  resolvedSnippet: string;
  headBranch: string;
  targetBranch: string;
}

export const ConflictTreeMapSvg: React.FC<ConflictTreeMapSvgProps> = ({
  pr,
  repo,
  files,
  onOpenRebaseModal,
  onAskGeminiAboutPr,
}) => {
  const [fetchedPrFiles, setFetchedPrFiles] = useState<string[]>([]);
  const [isLoadingPrFiles, setIsLoadingPrFiles] = useState<boolean>(false);

  // Fetch real PR files from GitHub if files prop is empty
  useEffect(() => {
    if ((!files || files.length === 0) && pr?.number && repo?.owner && repo?.repo) {
      setIsLoadingPrFiles(true);
      const storedToken =
        localStorage.getItem(`gh_token_${repo.owner}_${repo.repo}`) ||
        localStorage.getItem('gh_token_global') ||
        localStorage.getItem('github_token') ||
        undefined;

      fetch('/api/pr-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.repo,
          prNumber: pr.number,
          githubToken: storedToken,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.filenames) && data.filenames.length > 0) {
            setFetchedPrFiles(data.filenames);
          }
        })
        .catch(console.warn)
        .finally(() => setIsLoadingPrFiles(false));
    }
  }, [files, pr?.number, repo?.owner, repo?.repo]);

  const activeFilesList = useMemo(() => {
    if (files && files.length > 0) return files;
    return fetchedPrFiles;
  }, [files, fetchedPrFiles]);

  const [selectedFile, setSelectedFile] = useState<string | null>(activeFilesList[0] || null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Cache for fetched diffs per file path so switching between files is instant
  const [diffCache, setDiffCache] = useState<Record<string, FileDiffData>>({});
  const [diffErrors, setDiffErrors] = useState<Record<string, string>>({});
  const [isLoadingDiff, setIsLoadingDiff] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'3way' | 'patch' | 'resolved'>('3way');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Sync selectedFile if files list changes and current selection is invalid
  useEffect(() => {
    if (activeFilesList.length > 0 && (!selectedFile || !activeFilesList.includes(selectedFile))) {
      setSelectedFile(activeFilesList[0]);
    }
  }, [activeFilesList, selectedFile]);

  // Fetch real file diff for the selected file from the backend API
  const fetchFileDiff = useCallback(
    async (filenameToFetch: string, forceRefresh = false) => {
      if (!filenameToFetch) return;

      if (!forceRefresh && diffCache[filenameToFetch]) {
        return;
      }

      setIsLoadingDiff(true);
      try {
        const storedToken =
          localStorage.getItem(`gh_token_${repo.owner}_${repo.repo}`) ||
          localStorage.getItem('gh_token_global') ||
          localStorage.getItem('github_token') ||
          undefined;

        const res = await fetch('/api/pr-file-diff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            prNumber: pr.number,
            filename: filenameToFetch,
            title: pr.title,
            headBranch: pr.headBranch,
            targetBranch: pr.baseBranch || repo.defaultBranch || 'main',
            githubToken: storedToken,
          }),
        });

        if (res.ok) {
          const data: FileDiffData = await res.json();
          setDiffCache((prev) => ({
            ...prev,
            [filenameToFetch]: data,
          }));
          setDiffErrors((prev) => {
            const next = { ...prev };
            delete next[filenameToFetch];
            return next;
          });
        } else {
          const errData = await res.json().catch(() => ({}));
          setDiffErrors((prev) => ({
            ...prev,
            [filenameToFetch]: errData.error || `Failed to fetch diff for "${filenameToFetch}" (Status ${res.status})`,
          }));
        }
      } catch (err: any) {
        console.warn('Failed to fetch pr-file-diff from GitHub API:', err);
        setDiffErrors((prev) => ({
          ...prev,
          [filenameToFetch]: err?.message || 'Network error fetching PR diff from GitHub.',
        }));
      } finally {
        setIsLoadingDiff(false);
      }
    },
    [repo.owner, repo.repo, repo.defaultBranch, pr.number, pr.title, pr.headBranch, pr.baseBranch, diffCache]
  );

  // Trigger fetch when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      fetchFileDiff(selectedFile);
    }
  }, [selectedFile, fetchFileDiff]);

  // Current file details from cache
  const activeDiff: FileDiffData | null = selectedFile ? diffCache[selectedFile] || null : null;

  // Build hierarchical tree structure from file paths
  const treeRoot = useMemo(() => {
    const root: TreeNode = {
      id: 'root',
      name: `${repo.owner}/${repo.repo}`,
      path: '',
      type: 'folder',
      children: [],
      depth: 0,
    };

    activeFilesList.forEach((filePath, fileIdx) => {
      const parts = filePath.split('/').filter(Boolean);
      let currentNode = root;
      let currentPath = '';

      parts.forEach((part, partIdx) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isLeaf = partIdx === parts.length - 1;
        const existingChild = currentNode.children?.find((c) => c.name === part);

        if (existingChild) {
          currentNode = existingChild;
        } else {
          const fileExt = isLeaf && part.includes('.') ? part.split('.').pop() : undefined;
          const newNode: TreeNode = {
            id: `node-${fileIdx}-${partIdx}-${part}`,
            name: part,
            path: currentPath,
            type: isLeaf ? 'file' : 'folder',
            children: isLeaf ? undefined : [],
            isConflicted: isLeaf,
            fileExt,
            depth: partIdx + 1,
          };
          if (!currentNode.children) currentNode.children = [];
          currentNode.children.push(newNode);
          currentNode = newNode;
        }
      });
    });

    return root;
  }, [activeFilesList, repo.owner, repo.repo]);

  // Layout node coordinates for SVG rendering with collapsible branches
  const { nodes, links, bounds } = useMemo(() => {
    const nodeList: (TreeNode & { x: number; y: number })[] = [];
    const linkList: { source: { x: number; y: number }; target: { x: number; y: number }; id: string }[] = [];

    let currentY = 32;
    const xStep = 185;
    const yStep = 54;
    let maxX = 220;

    function layoutNode(node: TreeNode, depth: number, parentPos?: { x: number; y: number }) {
      const x = 32 + depth * xStep;
      maxX = Math.max(maxX, x + 165);

      const isCollapsed = collapsedFolders.has(node.path);
      const hasChildren = node.children && node.children.length > 0;

      if (!hasChildren || isCollapsed) {
        const y = currentY;
        currentY += yStep;
        const positionedNode = { ...node, x, y };
        nodeList.push(positionedNode);

        if (parentPos) {
          linkList.push({
            id: `${parentPos.x}-${parentPos.y}->${x}-${y}`,
            source: parentPos,
            target: { x, y },
          });
        }
        return y;
      }

      // Expanded folder with children
      const childYPositions: number[] = [];
      const positionedNode = { ...node, x, y: 0 };

      node.children?.forEach((child) => {
        const childY = layoutNode(child, depth + 1, { x: x + 130, y: 0 });
        childYPositions.push(childY);
      });

      const avgY =
        childYPositions.length > 0
          ? (childYPositions[0] + childYPositions[childYPositions.length - 1]) / 2
          : currentY;

      positionedNode.y = avgY;
      nodeList.push(positionedNode);

      if (parentPos) {
        linkList.push({
          id: `${parentPos.x}-${parentPos.y}->${x}-${avgY}`,
          source: parentPos,
          target: { x, y: avgY },
        });
      }

      linkList.forEach((link) => {
        if (link.source.x === x + 130 && link.source.y === 0) {
          link.source.y = avgY;
        }
      });

      return avgY;
    }

    layoutNode(treeRoot, 0);

    return {
      nodes: nodeList,
      links: linkList,
      bounds: {
        width: Math.max(maxX + 60, 560),
        height: Math.max(currentY + 24, 210),
      },
    };
  }, [treeRoot, collapsedFolders]);

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(0.6, prev + delta), 1.8));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleCopyCode = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(label);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-slate-950 p-4 space-y-4">
      {/* Top Header & Visualizer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Interactive Conflict Tree Visualizer</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-300 font-mono">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Click any file node below to inspect genuine PR file diffs, 3-way AST collisions, and clean rebase resolutions.
            </p>
          </div>
        </div>

        {/* Zoom & Viewport Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-900 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => handleZoom(0.15)}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.15)}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 px-1">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleResetZoom}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset Zoom"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative rounded-xl border border-slate-800/90 bg-slate-900/60 overflow-hidden min-h-[220px] max-h-[360px] flex items-center justify-center p-2 shadow-inner">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        <div className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing">
          <svg
            width={bounds.width * zoomLevel}
            height={bounds.height * zoomLevel}
            viewBox={`0 0 ${bounds.width} ${bounds.height}`}
            className="transition-transform duration-100 ease-out select-none"
          >
            <defs>
              {/* Linear gradient for connector curves */}
              <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>

              {/* Node drop shadows and glows */}
              <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.25" />
              </filter>
              <filter id="selectedGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#06b6d4" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Connecting Bézier Curves between Tree Nodes */}
            <g className="links">
              {links.map((link) => {
                const dx = link.target.x - link.source.x;
                const pathD = `M ${link.source.x} ${link.source.y} C ${link.source.x + dx * 0.5} ${link.source.y}, ${link.source.x + dx * 0.5} ${link.target.y}, ${link.target.x} ${link.target.y}`;
                return (
                  <path
                    key={link.id}
                    d={pathD}
                    fill="none"
                    stroke="url(#linkGradient)"
                    strokeWidth="1.75"
                    strokeDasharray="4 2"
                    className="opacity-70 transition-all hover:opacity-100"
                  />
                );
              })}
            </g>

            {/* Tree Nodes */}
            <g className="nodes">
              {nodes.map((node) => {
                const isSelected = selectedFile === node.path;
                const isHovered = hoveredNodeId === node.id;
                const isFolder = node.type === 'folder';
                const isRoot = node.id === 'root';
                const isCollapsed = isFolder && collapsedFolders.has(node.path);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer transition-transform duration-150"
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => {
                      if (isFolder && !isRoot) {
                        toggleFolder(node.path);
                      } else if (!isFolder) {
                        setSelectedFile(node.path);
                      }
                    }}
                  >
                    {/* Pulsing selection halo for conflicted / active node */}
                    {isSelected && (
                      <circle
                        cx="0"
                        cy="0"
                        r="18"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        className="animate-ping opacity-30"
                      />
                    )}

                    {/* Node Background Badge */}
                    <rect
                      x="-14"
                      y="-14"
                      width={isFolder ? 140 : 160}
                      height="28"
                      rx="8"
                      fill={
                        isSelected
                          ? '#082f49'
                          : isHovered
                          ? '#1e293b'
                          : isFolder
                          ? '#0f172a'
                          : '#18181b'
                      }
                      stroke={
                        isSelected
                          ? '#06b6d4'
                          : node.isConflicted
                          ? '#f59e0b'
                          : '#334155'
                      }
                      strokeWidth={isSelected ? '2' : '1.2'}
                      filter={isSelected ? 'url(#selectedGlow)' : node.isConflicted ? 'url(#nodeGlow)' : undefined}
                      className="transition-colors duration-150"
                    />

                    {/* Node Icon */}
                    <g transform="translate(-6, -7)">
                      {isFolder ? (
                        isCollapsed ? (
                          <Folder className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <FolderOpen className="h-3.5 w-3.5 text-cyan-400" />
                        )
                      ) : (
                        <FileCode className="h-3.5 w-3.5 text-amber-300" />
                      )}
                    </g>

                    {/* Node Label Text */}
                    <text
                      x="16"
                      y="4"
                      fill={isSelected ? '#38bdf8' : node.isConflicted ? '#fef08a' : '#e2e8f0'}
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      className="select-none pointer-events-none"
                    >
                      {node.name.length > 17 ? `${node.name.slice(0, 15)}…` : node.name}
                    </text>

                    {/* Status Badge Tag for Conflicted Leaves */}
                    {node.isConflicted && (
                      <g transform="translate(130, -6)">
                        <circle cx="5" cy="5" r="4.5" fill="#f59e0b" />
                        <text
                          x="5"
                          y="7.5"
                          textAnchor="middle"
                          fill="#0f172a"
                          fontSize="7"
                          fontWeight="bold"
                        >
                          !
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Selected File Drilldown Inspector */}
      {selectedFile && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 animate-in fade-in duration-150 shadow-lg">
          {/* File Header & Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <Code2 className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-cyan-300">
                    {selectedFile}
                  </span>

                  {activeDiff && (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase tracking-wide border border-amber-500/30">
                      {activeDiff.collisionType}
                    </span>
                  )}

                  {activeDiff?.isLiveFromGitHub && (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wide border border-emerald-500/30 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live GitHub PR Patch
                    </span>
                  )}

                  {!activeDiff?.isLiveFromGitHub && activeDiff && (
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wide border border-cyan-500/30">
                      AST Conflict Analysis
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-0.5">
                  Inspecting file changes between <span className="font-mono text-cyan-400">{pr.headBranch || 'patch'}</span> (PR #{pr.number}) and <span className="font-mono text-emerald-400">{pr.baseBranch || repo.defaultBranch || 'main'}</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => fetchFileDiff(selectedFile, true)}
                disabled={isLoadingDiff}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Refresh Diff"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDiff ? 'animate-spin text-cyan-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {onOpenRebaseModal && (
                <button
                  onClick={() => onOpenRebaseModal(pr)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 transition-colors shadow-sm"
                  title="Open full interactive rebase engine"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  <span>Rebase This File</span>
                </button>
              )}

              {onAskGeminiAboutPr && (
                <button
                  onClick={() => onAskGeminiAboutPr(pr)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Analyze conflict using Gemini AI"
                >
                  <Bot className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Ask AI</span>
                </button>
              )}
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('3way')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === '3way'
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileCode className="h-3 w-3" />
                <span>3-Way Conflict Diff</span>
              </button>

              <button
                onClick={() => setActiveTab('patch')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'patch'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileDiff className="h-3 w-3" />
                <span>Unified Git Diff Patch</span>
              </button>

              <button
                onClick={() => setActiveTab('resolved')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'resolved'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sparkles className="h-3 w-3" />
                <span>Clean Merged Code</span>
              </button>
            </div>

            {/* Line Additions / Deletions Stats */}
            {activeDiff && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-emerald-400">+{activeDiff.additions || 0}</span>
                <span className="text-rose-400">-{activeDiff.deletions || 0}</span>
              </div>
            )}
          </div>

          {/* Loading Indicator for Diff */}
          {isLoadingDiff && !activeDiff && (
            <div className="flex flex-col items-center justify-center p-8 space-y-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              <span className="text-xs font-mono">
                Loading code diff and AST reconciliation for {selectedFile}...
              </span>
            </div>
          )}

          {/* Error Banner if diff fetching fails */}
          {diffErrors[selectedFile] && !isLoadingDiff && !activeDiff && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-300">GitHub Diff Loading Notice</h4>
                  <p className="text-xs text-rose-200/80 leading-relaxed">
                    {diffErrors[selectedFile]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 pl-6">
                <button
                  onClick={() => fetchFileDiff(selectedFile, true)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 rounded transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Retry Fetching from GitHub</span>
                </button>
              </div>
            </div>
          )}

          {/* Content Pane: 3-Way AST Conflict Diff */}
          {activeDiff && activeTab === '3way' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {/* Target Branch Version */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <span>HEAD ({activeDiff.targetBranch})</span>
                    </span>
                    <button
                      onClick={() => handleCopyCode(activeDiff.targetConflictSnippet, 'target')}
                      className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedSnippet === 'target' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSnippet === 'target' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="rounded bg-slate-900/90 border border-slate-800 p-2.5 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-64">
                    {activeDiff.targetConflictSnippet}
                  </pre>
                </div>

                {/* Incoming Pull Request Version */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-cyan-400 flex items-center gap-1">
                      <span>PR #{pr.number} ({activeDiff.headBranch})</span>
                    </span>
                    <button
                      onClick={() => handleCopyCode(activeDiff.incomingConflictSnippet, 'incoming')}
                      className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1"
                    >
                      {copiedSnippet === 'incoming' ? <Check className="h-3 w-3 text-cyan-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSnippet === 'incoming' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="rounded bg-slate-900/90 border border-slate-800 p-2.5 text-[10px] font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-64">
                    {activeDiff.incomingConflictSnippet}
                  </pre>
                </div>
              </div>

              {/* Clean 3-Way Semantic Merged Code Preview */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Automated 3-Way AST Reconciliation Plan</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(activeDiff.resolvedSnippet, 'resolved')}
                      className="text-emerald-400 hover:text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                    >
                      {copiedSnippet === 'resolved' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSnippet === 'resolved' ? 'Copied' : 'Copy Resolved'}</span>
                    </button>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Zero Regression
                    </span>
                  </div>
                </div>
                <pre className="rounded-lg bg-slate-950 border border-slate-800 p-2.5 text-[10px] font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-64">
                  {activeDiff.resolvedSnippet}
                </pre>
              </div>
            </div>
          )}

          {/* Content Pane: Unified Git Diff Patch */}
          {activeDiff && activeTab === 'patch' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  diff --git a/{selectedFile} b/{selectedFile}
                </span>
                <button
                  onClick={() => handleCopyCode(activeDiff.rawPatch || '', 'patch')}
                  className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1"
                >
                  {copiedSnippet === 'patch' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSnippet === 'patch' ? 'Copied Patch' : 'Copy Git Patch'}</span>
                </button>
              </div>

              <div className="rounded bg-slate-900/90 border border-slate-800 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-80 space-y-0.5">
                {(activeDiff.rawPatch || `// No raw patch provided for ${selectedFile}`).split('\n').map((line, idx) => {
                  let lineStyle = 'text-slate-300';
                  let bgStyle = '';

                  if (line.startsWith('@@')) {
                    lineStyle = 'text-cyan-400 font-bold';
                    bgStyle = 'bg-cyan-950/20 px-1 py-0.5 rounded';
                  } else if (line.startsWith('+')) {
                    lineStyle = 'text-emerald-400';
                    bgStyle = 'bg-emerald-950/20 px-1 py-0.5 rounded';
                  } else if (line.startsWith('-')) {
                    lineStyle = 'text-rose-400';
                    bgStyle = 'bg-rose-950/20 px-1 py-0.5 rounded';
                  }

                  return (
                    <div key={idx} className={`${lineStyle} ${bgStyle} whitespace-pre`}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content Pane: Resolved Merged Code */}
          {activeDiff && activeTab === 'resolved' && (
            <div className="rounded-lg border border-emerald-500/20 bg-slate-950 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Synthesized & Reconciled Source Code for {selectedFile}</span>
                </div>
                <button
                  onClick={() => handleCopyCode(activeDiff.resolvedSnippet, 'resolvedFull')}
                  className="flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 hover:bg-emerald-500/30"
                >
                  {copiedSnippet === 'resolvedFull' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSnippet === 'resolvedFull' ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              <pre className="rounded-lg bg-slate-900/90 border border-slate-800 p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed max-h-80">
                {activeDiff.resolvedSnippet}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
