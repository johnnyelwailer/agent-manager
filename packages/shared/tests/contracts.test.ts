import { describe, it, expect } from 'bun:test';
import {
  commandContractSchema,
  claudeCommandContractSchema,
  specializedCommandContractSchema,
  skillContractSchema,
  claudeSkillContractSchema,
  gsdSkillContractSchema,
  specializedSkillContractSchema,
  taskContractSchema,
  claudeTaskContractSchema,
  gsdTaskContractSchema,
  specializedTaskContractSchema,
  researchDocContractSchema,
  worktreeContractSchema,
  mcpContractSchema,
  hookContractSchema,
  chatElementContractSchema,
  choiceElementSchema,
  confirmationElementSchema,
  toolCallElementSchema,
  codeBlockElementSchema,
  costTickerElementSchema,
  diffViewElementSchema,
  progressElementSchema,
  formElementSchema,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// CommandContract
// ---------------------------------------------------------------------------

describe('CommandContract', () => {
  const validCommand = {
    id: 'cmd-1',
    name: 'commit',
    description: 'Create a git commit',
    source: 'built_in' as const,
    adapterId: 'claude-cli',
  };

  it('parses a valid command', () => {
    const result = commandContractSchema.safeParse(validCommand);
    expect(result.success).toBe(true);
  });

  it('parses a command with parameters', () => {
    const result = commandContractSchema.safeParse({
      ...validCommand,
      parameters: [{ name: 'message', type: 'string', required: true }],
      keybinding: 'Ctrl+K',
      category: 'git',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid source', () => {
    const result = commandContractSchema.safeParse({ ...validCommand, source: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('parses Claude specialization', () => {
    const result = claudeCommandContractSchema.safeParse({
      ...validCommand,
      specialization: 'claude',
      slashCommand: '/commit',
    });
    expect(result.success).toBe(true);
  });

  it('discriminates specializations', () => {
    const claude = specializedCommandContractSchema.safeParse({
      ...validCommand,
      specialization: 'claude',
      slashCommand: '/commit',
    });
    expect(claude.success).toBe(true);

    const generic = specializedCommandContractSchema.safeParse({
      ...validCommand,
      specialization: 'generic',
    });
    expect(generic.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SkillContract
// ---------------------------------------------------------------------------

describe('SkillContract', () => {
  const validSkill = {
    id: 'skill-1',
    name: 'Code Review',
    description: 'Review code changes',
    adapterId: 'claude-cli',
  };

  it('parses a valid skill', () => {
    const result = skillContractSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
  });

  it('applies defaults', () => {
    const result = skillContractSchema.parse(validSkill);
    expect(result.autoDiscoverable).toBe(false);
    expect(result.enabled).toBe(true);
    expect(result.triggers).toEqual([]);
    expect(result.tags).toEqual([]);
  });

  it('parses with triggers', () => {
    const result = skillContractSchema.safeParse({
      ...validSkill,
      triggers: [{ type: 'keyword', value: 'review' }],
      autoDiscoverable: true,
      tags: ['review', 'quality'],
    });
    expect(result.success).toBe(true);
  });

  it('parses Claude specialization', () => {
    const result = claudeSkillContractSchema.safeParse({
      ...validSkill,
      specialization: 'claude',
      source: 'autodiscovered',
      slashCommand: 'review-pr',
      globs: ['**/*.ts'],
    });
    expect(result.success).toBe(true);
  });

  it('parses GSD specialization', () => {
    const result = gsdSkillContractSchema.safeParse({
      ...validSkill,
      specialization: 'gsd',
      constitutionRef: 'const-1',
      phase: 'execute',
    });
    expect(result.success).toBe(true);
  });

  it('discriminates specializations', () => {
    const result = specializedSkillContractSchema.safeParse({
      ...validSkill,
      specialization: 'claude',
      source: 'user_defined',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TaskContract
// ---------------------------------------------------------------------------

describe('TaskContract', () => {
  const validTask = {
    id: 'task-1',
    title: 'Implement login feature',
    status: 'pending' as const,
    adapterId: 'claude-cli',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  it('parses a valid task', () => {
    const result = taskContractSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('parses with subtasks and progress', () => {
    const result = taskContractSchema.safeParse({
      ...validTask,
      status: 'in_progress',
      progress: 50,
      subtasks: [
        { id: 'sub-1', title: 'Write tests', status: 'completed' },
        { id: 'sub-2', title: 'Implement feature', status: 'in_progress' },
      ],
      priority: 'high',
      labels: ['feature', 'auth'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects progress out of range', () => {
    expect(taskContractSchema.safeParse({ ...validTask, progress: 150 }).success).toBe(false);
    expect(taskContractSchema.safeParse({ ...validTask, progress: -5 }).success).toBe(false);
  });

  it('parses Claude task with todos', () => {
    const result = claudeTaskContractSchema.safeParse({
      ...validTask,
      specialization: 'claude',
      todoItems: [
        { content: 'Write tests', status: 'completed' },
        { content: 'Implement feature', status: 'in_progress' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('parses GSD task with grade', () => {
    const result = gsdTaskContractSchema.safeParse({
      ...validTask,
      specialization: 'gsd',
      phase: 'execution',
      grade: 'A',
    });
    expect(result.success).toBe(true);
  });

  it('discriminates specializations', () => {
    const result = specializedTaskContractSchema.safeParse({
      ...validTask,
      specialization: 'generic',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ResearchDocContract
// ---------------------------------------------------------------------------

describe('ResearchDocContract', () => {
  it('parses a valid research doc', () => {
    const result = researchDocContractSchema.safeParse({
      id: 'doc-1',
      title: 'Implementation Plan',
      content: '# Plan\n\nStep 1...',
      format: 'markdown',
      role: 'plan',
      adapterId: 'claude-cli',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('supports all roles', () => {
    const roles = ['plan', 'constitution', 'analysis', 'rules', 'notes', 'report', 'specification', 'custom'] as const;
    for (const role of roles) {
      const result = researchDocContractSchema.safeParse({
        id: 'doc-1',
        title: 'Test',
        content: 'content',
        format: 'plain_text',
        role,
        adapterId: 'test',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// WorktreeContract
// ---------------------------------------------------------------------------

describe('WorktreeContract', () => {
  it('parses a valid worktree', () => {
    const result = worktreeContractSchema.safeParse({
      id: 'wt-1',
      path: '/home/user/project',
      branch: 'feature/login',
      repo: 'my-app',
      status: 'dirty',
      createdAt: '2026-01-01T00:00:00Z',
      changedFiles: 3,
    });
    expect(result.success).toBe(true);
  });

  it('supports ahead/behind', () => {
    const result = worktreeContractSchema.safeParse({
      id: 'wt-1',
      path: '/home/user/project',
      branch: 'main',
      repo: 'my-app',
      status: 'clean',
      isMain: true,
      createdAt: '2026-01-01T00:00:00Z',
      aheadBehind: { ahead: 2, behind: 0 },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// McpContract
// ---------------------------------------------------------------------------

describe('McpContract', () => {
  it('parses a valid MCP server', () => {
    const result = mcpContractSchema.safeParse({
      id: 'mcp-1',
      name: 'GitHub',
      uri: 'npx://github-mcp',
      status: 'connected',
      tools: [
        { name: 'create_issue', description: 'Create a GitHub issue' },
        { name: 'list_prs' },
      ],
      resources: [{ uri: 'repo://my-org/my-repo', name: 'Repository' }],
      prompts: [{ name: 'review', arguments: [{ name: 'pr_number', required: true }] }],
      adapterId: 'claude-cli',
    });
    expect(result.success).toBe(true);
  });

  it('supports error state', () => {
    const result = mcpContractSchema.safeParse({
      id: 'mcp-2',
      name: 'Broken Server',
      uri: 'stdio://broken',
      status: 'error',
      adapterId: 'claude-cli',
      errorMessage: 'Connection refused',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HookContract
// ---------------------------------------------------------------------------

describe('HookContract', () => {
  it('parses a valid hook', () => {
    const result = hookContractSchema.safeParse({
      id: 'hook-1',
      event: 'pre_commit',
      name: 'Lint Check',
      handler: 'npm run lint',
      enabled: true,
      adapterId: 'claude-cli',
    });
    expect(result.success).toBe(true);
  });

  it('parses with run history', () => {
    const result = hookContractSchema.safeParse({
      id: 'hook-2',
      event: 'session_start',
      name: 'Setup',
      handler: 'npm install',
      enabled: true,
      adapterId: 'claude-cli',
      lastRunAt: '2026-01-01T00:00:00Z',
      lastRunResult: 'success',
      runCount: 5,
      timeout: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('supports all hook events', () => {
    const events = ['session_start', 'session_end', 'pre_tool_use', 'post_tool_use', 'pre_commit', 'post_commit', 'on_error', 'custom'] as const;
    for (const event of events) {
      const result = hookContractSchema.safeParse({
        id: 'hook-test',
        event,
        name: 'Test',
        handler: 'echo test',
        adapterId: 'test',
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ChatElementContract
// ---------------------------------------------------------------------------

describe('ChatElementContract', () => {
  it('parses choice element', () => {
    const result = choiceElementSchema.safeParse({
      type: 'choice',
      id: 'choice-1',
      prompt: 'Which approach?',
      options: [
        { id: 'a', label: 'Option A' },
        { id: 'b', label: 'Option B', description: 'The better one' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('parses confirmation element', () => {
    const result = confirmationElementSchema.safeParse({
      type: 'confirmation',
      id: 'confirm-1',
      prompt: 'Apply these changes?',
      details: '3 files modified',
    });
    expect(result.success).toBe(true);
  });

  it('parses tool call element', () => {
    const result = toolCallElementSchema.safeParse({
      type: 'tool_call',
      id: 'tc-1',
      toolName: 'Read',
      input: { file_path: '/tmp/test.ts' },
      output: 'file contents here',
      durationMs: 50,
    });
    expect(result.success).toBe(true);
  });

  it('parses code block element', () => {
    const result = codeBlockElementSchema.safeParse({
      type: 'code_block',
      id: 'code-1',
      language: 'typescript',
      code: 'const x = 1;',
      filePath: 'src/test.ts',
      startLine: 10,
      actions: ['copy', 'apply'],
    });
    expect(result.success).toBe(true);
  });

  it('parses cost ticker element', () => {
    const result = costTickerElementSchema.safeParse({
      type: 'cost_ticker',
      id: 'cost-1',
      costUsd: 0.0342,
      tokensIn: 15000,
      tokensOut: 3000,
      model: 'claude-sonnet',
    });
    expect(result.success).toBe(true);
  });

  it('parses diff view element', () => {
    const result = diffViewElementSchema.safeParse({
      type: 'diff',
      id: 'diff-1',
      filePath: 'src/app.ts',
      hunks: [{
        oldStart: 10,
        oldLines: 3,
        newStart: 10,
        newLines: 5,
        content: ' line1\n-old line\n+new line\n+added line\n line3',
      }],
      mode: 'unified',
    });
    expect(result.success).toBe(true);
  });

  it('parses progress element', () => {
    const result = progressElementSchema.safeParse({
      type: 'progress',
      id: 'prog-1',
      label: 'Building...',
      progress: 75,
      status: 'running',
    });
    expect(result.success).toBe(true);
  });

  it('parses form element', () => {
    const result = formElementSchema.safeParse({
      type: 'form',
      id: 'form-1',
      title: 'Session Config',
      fields: [
        { name: 'model', label: 'Model', type: 'select', choices: ['sonnet', 'opus'] },
        { name: 'budget', label: 'Budget', type: 'number', required: true },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('discriminated union parses all element types', () => {
    const elements = [
      { type: 'choice', id: 'c1', prompt: 'Pick', options: [{ id: 'a', label: 'A' }] },
      { type: 'confirmation', id: 'c2', prompt: 'OK?' },
      { type: 'file_selector', id: 'c3', prompt: 'Pick file' },
      { type: 'progress', id: 'c4', label: 'Loading', progress: 50, status: 'running' },
      { type: 'code_block', id: 'c5', language: 'ts', code: 'x', actions: ['copy'] },
      { type: 'tool_call', id: 'c6', toolName: 'Read', input: {} },
      { type: 'cost_ticker', id: 'c7', costUsd: 0.01, tokensIn: 100, tokensOut: 50 },
      { type: 'diff', id: 'c8', filePath: 'a.ts', hunks: [] },
      { type: 'form', id: 'c9', title: 'Form', fields: [] },
    ];

    for (const el of elements) {
      const result = chatElementContractSchema.safeParse(el);
      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown element type', () => {
    const result = chatElementContractSchema.safeParse({
      type: 'unknown',
      id: 'x',
    });
    expect(result.success).toBe(false);
  });
});
