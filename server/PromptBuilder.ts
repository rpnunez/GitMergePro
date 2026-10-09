/**
 * PromptBuilder.ts
 *
 * Centralized registry and builder for all Gemini AI prompts and system instructions across GitMergePro.
 * Provides type-safe string interpolation, schema configs, and prompt template management.
 */

export type PromptId =
  | 'rebase-conflicts'
  | 'pr-file-diff'
  | 'pseudo-build'
  | 'chat-system';

export interface RebaseConflictsPromptParams {
  repoSlug: string;
  prNumber: number | string;
  title: string;
  headBranch?: string;
  targetBranch?: string;
  filesToResolve: string[] | string;
}

export interface PrFileDiffPromptParams {
  owner: string;
  repo: string;
  prNumber: number | string;
  title: string;
  headBranch?: string;
  targetBranch?: string;
  filename: string;
  rawPatch?: string;
  targetContent?: string;
  incomingContent?: string;
}

export interface PseudoBuildPromptParams {
  repo: string;
  targetBranch?: string;
  prSummaries: any[] | string;
}

export interface ChatSystemPromptParams {
  role?: 'merge_architect' | 'conflict_specialist' | 'ci_diagnostician' | string;
  repoContext?: {
    owner: string;
    repo: string;
    defaultBranch?: string;
  } | null;
  prContext?: {
    number: number | string;
    title: string;
    ciStatus?: string;
    hasConflicts?: boolean;
    staticAnalysisStatus?: string;
    automatedLabelsSummary?: string;
  } | null;
}

export type PromptParamsMap = {
  'rebase-conflicts': RebaseConflictsPromptParams;
  'pr-file-diff': PrFileDiffPromptParams;
  'pseudo-build': PseudoBuildPromptParams;
  'chat-system': ChatSystemPromptParams;
};

export interface PromptConfig {
  responseMimeType?: string;
  temperature?: number;
}

export interface PromptDefinition<T = any> {
  id: PromptId;
  description: string;
  config?: PromptConfig;
  template: string | ((params: T) => string);
}

/**
 * Helper to interpolate template string with {{key}} or ${key} tokens from key-value pairs
 */
export function interpolateString(template: string, values: Record<string, any>): string {
  return template.replace(/(\{\{|\$\{)([a-zA-Z0-9_.-]+)(\}\})/g, (_, _open, key) => {
    const val = values[key];
    if (val === undefined || val === null) {
      return '';
    }
    if (typeof val === 'object') {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  });
}

// System role instructions used for AI chat and diagnostics
export const ROLE_INSTRUCTIONS: Record<string, string> = {
  merge_architect: `You are the Lead Merge Train Architect for a high-velocity engineering organization. Your primary objective is keeping the main branch green, minimizing integration queue latency, detecting cross-PR hazards, and optimizing PR batches for pseudo-builds. Be concise, technically precise, and actionable.`,
  conflict_specialist: `You are a Git Rebase and Conflict Resolution Specialist. You analyze file collisions, 3-way merge markers (<<<<<<< HEAD, =======, >>>>>>>), AST changes, package-lock and imports conflicts. You provide concrete resolved code and safe rebase commands.`,
  ci_diagnostician: `You are a GitHub Actions CI & Static Analysis Diagnostician. You pinpoint flaky tests, jest/vitest/playwright failures, TypeScript compilation bugs, and security/linter issues blocking PR merges. Give clear, fast debugging steps.`,
};

/**
 * Built-in Prompt Definitions Registry
 */
export const PROMPT_REGISTRY: Record<PromptId, PromptDefinition> = {
  'rebase-conflicts': {
    id: 'rebase-conflicts',
    description: 'Generates automated 3-way semantic Git rebase plan, AST code resolution, and CLI git command sequence for conflicted PR files.',
    config: {
      responseMimeType: 'application/json',
    },
    template: (params: RebaseConflictsPromptParams) => {
      const filesFormatted =
        typeof params.filesToResolve === 'string'
          ? params.filesToResolve
          : JSON.stringify(params.filesToResolve || []);

      return `You are an automated Git rebase and AST collision resolver engine for repository "${params.repoSlug}".
Pull Request #${params.prNumber}: "${params.title}" (source branch "${params.headBranch || 'feature'}") has merge conflicts rebasing onto "${params.targetBranch || 'main'}".
The conflicted files from this pull request are: ${filesFormatted}

Task:
1. Provide a rebase plan that resolves simple file collisions for these exact files (imports/requires, non-overlapping functions, dependency bumps, configuration keys).
2. For each conflicted file in this PR, generate an explanation of what collided and the cleanly resolved merged file representation appropriate for the file extension and language (e.g. PHP if .php, TS/JS if .ts/.tsx, Python if .py, etc.).
3. Provide the exact safe git command sequence to rebase ${params.headBranch || 'feature'} onto ${params.targetBranch || 'main'} cleanly.

Respond with JSON in the following schema:
{
  "success": true,
  "rebaseMethod": "3-Way Semantic Rebase with AST & Import De-duplication",
  "filesResolved": [
    {
      "file": "string",
      "collisionType": "imports | function_overlap | config_bump | duplicate_keys",
      "resolutionSummary": "string",
      "resolvedSnippet": "string"
    }
  ],
  "gitCommands": ["git fetch origin", "git checkout ...", "git rebase ..."],
  "cleanMergabilityScore": 98,
  "confidenceNotes": "string"
}`;
    },
  },

  'pr-file-diff': {
    id: 'pr-file-diff',
    description: 'Generates authentic source code diffs and 3-way AST resolution for a specific conflicted file in a given PR.',
    config: {
      responseMimeType: 'application/json',
    },
    template: (params: PrFileDiffPromptParams) => {
      const repoPath = params.owner ? `${params.owner}/${params.repo}` : params.repo;
      let contextAddendum = '';
      if (params.rawPatch) {
        contextAddendum += `\n\nActual Git Unified Patch from GitHub PR:\n\`\`\`diff\n${params.rawPatch}\n\`\`\``;
      }
      if (params.targetContent) {
        contextAddendum += `\n\nTarget branch file content (${params.targetBranch || 'main'}):\n\`\`\`\n${params.targetContent.slice(0, 1500)}\n\`\`\``;
      }
      if (params.incomingContent) {
        contextAddendum += `\n\nIncoming PR head file content (${params.headBranch || 'feature'}):\n\`\`\`\n${params.incomingContent.slice(0, 1500)}\n\`\`\``;
      }

      return `You are a Git conflict diff and AST reconciliation engine for repository "${repoPath}".
Pull Request #${params.prNumber}: "${params.title}" (source branch "${params.headBranch || 'feature'}") conflicting with "${params.targetBranch || 'main'}".
Inspecting file: "${params.filename}".${contextAddendum}

Analyze the real file changes, identify the precise collision type (e.g. "AST Function Signature Collision", "Export & Module Collision", "Dependency Lockfile Conflict", etc.), and provide a clean 3-way reconciliation strictly based on the real code.

Respond strictly with JSON:
{
  "collisionType": "string",
  "targetConflictSnippet": "exact conflicted section from target branch (${params.targetBranch || 'main'})",
  "incomingConflictSnippet": "exact conflicted section from incoming PR #${params.prNumber}",
  "resolvedSnippet": "cleanly reconciled merged result without conflict markers",
  "rawPatch": "unified git diff starting with @@"
}`;
    },
  },

  'pseudo-build': {
    id: 'pseudo-build',
    description: 'Evaluates multi-PR composite merge train simulation to detect overlapping file collisions and test suite hazards before deployment.',
    config: {
      responseMimeType: 'application/json',
    },
    template: (params: PseudoBuildPromptParams) => {
      const summariesFormatted =
        typeof params.prSummaries === 'string'
          ? params.prSummaries
          : JSON.stringify(params.prSummaries || [], null, 2);

      return `You are evaluating a multi-PR "Pseudo Build" merge train simulation for repo "${params.repo}".
Target branch: "${params.targetBranch || 'main'}".
Selected PRs to merge simultaneously into a composite build:
${summariesFormatted}

Analyze:
1. Inter-PR file collision risk (do multiple PRs modify overlapping files in this repo?).
2. CI status risk (are all CI test suites passing?).
3. Recommended merge sequence order.
4. Summary evaluation.

Respond with JSON format:
{
  "canMergeAll": true/false,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "BLOCKING",
  "mergeOrder": [101, 102],
  "collisionsFound": [
    { "file": "string", "prsInvolved": [101, 102], "resolution": "string" }
  ],
  "summary": "Full markdown-friendly pseudo build report",
  "safeToDeploy": true/false
}`;
    },
  },

  'chat-system': {
    id: 'chat-system',
    description: 'Builds comprehensive multi-turn system instruction incorporating role expertise, active repository, and pull request context.',
    template: (params: ChatSystemPromptParams) => {
      const role = params.role || 'merge_architect';
      let systemInstruction = ROLE_INSTRUCTIONS[role] || ROLE_INSTRUCTIONS.merge_architect;

      if (params.repoContext) {
        systemInstruction += `\n\nActive Repository Context: ${params.repoContext.owner}/${params.repoContext.repo} (Target Branch: ${params.repoContext.defaultBranch || 'main'}).`;
      }
      if (params.prContext) {
        systemInstruction += `\nInspecting Pull Request #${params.prContext.number}: "${params.prContext.title}". CI Status: ${params.prContext.ciStatus || 'unknown'}. Conflicts: ${params.prContext.hasConflicts ? 'YES' : 'NONE'}. Static Analysis: ${params.prContext.staticAnalysisStatus || 'clean'}. Labels: ${params.prContext.automatedLabelsSummary || 'None'}.`;
      }

      return systemInstruction;
    },
  },
};

/**
 * Primary PromptBuilder class providing fluent and functional interfaces
 */
export class PromptBuilder {
  private id: PromptId;
  private params: Record<string, any> = {};

  constructor(id: PromptId, initialParams?: Record<string, any>) {
    this.id = id;
    if (initialParams) {
      this.params = { ...initialParams };
    }
  }

  /**
   * Add or override key/value pairs for prompt interpolation
   */
  public set(key: string, value: any): this {
    this.params[key] = value;
    return this;
  }

  /**
   * Merge an object of key/value pairs
   */
  public with(params: Record<string, any>): this {
    this.params = { ...this.params, ...params };
    return this;
  }

  /**
   * Build the prompt string
   */
  public build(): string {
    return PromptBuilder.build(this.id, this.params);
  }

  /**
   * Retrieve the recommended Gemini configuration for this prompt
   */
  public getConfig(): PromptConfig {
    return PromptBuilder.getConfig(this.id);
  }

  /**
   * Static helper: Build a prompt by ID and parameters object
   */
  public static build<K extends PromptId>(id: K, params: PromptParamsMap[K] | Record<string, any>): string {
    const def = PROMPT_REGISTRY[id];
    if (!def) {
      throw new Error(`Unknown prompt ID: "${id}". Registered prompts: ${Object.keys(PROMPT_REGISTRY).join(', ')}`);
    }

    if (typeof def.template === 'function') {
      return def.template(params);
    }

    return interpolateString(def.template, params);
  }

  /**
   * Static helper: Get recommended Gemini config for prompt ID
   */
  public static getConfig(id: PromptId): PromptConfig {
    const def = PROMPT_REGISTRY[id];
    return def?.config || {};
  }

  /**
   * Register a new prompt template or override an existing one
   */
  public static registerPrompt(def: PromptDefinition): void {
    PROMPT_REGISTRY[def.id] = def;
  }

  /**
   * Helper to build chat system instruction
   */
  public static buildSystemInstruction(params: ChatSystemPromptParams): string {
    return PromptBuilder.build('chat-system', params);
  }
}

/**
 * Functional convenience export: buildPrompt('rebase-conflicts', params)
 */
export function buildPrompt<K extends PromptId>(
  promptId: K,
  params: PromptParamsMap[K] | Record<string, any>
): string {
  return PromptBuilder.build(promptId, params);
}

/**
 * Functional convenience export: getPromptConfig('rebase-conflicts')
 */
export function getPromptConfig(promptId: PromptId): PromptConfig {
  return PromptBuilder.getConfig(promptId);
}
