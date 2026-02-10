import { useState, useMemo } from 'react';
import {
  SkillCard,
  TaskCard,
  McpBrowser,
  HookConfigPanel,
  WorktreeSelector,
  ResearchDocViewer,
  ToolCallViewer,
  CodeBlock,
  CostTicker,
  DiffView,
  ProgressIndicator,
} from '@agent-manager/ui';
import type {
  SkillContract,
  ClaudeSkillContract,
  TaskContract,
  McpContract,
  HookContract,
  WorktreeContract,
  ResearchDocContract,
  ToolCallElement,
  CodeBlockElement,
  CostTickerElement,
  DiffViewElement,
  ProgressElement,
  SessionSummary,
} from '@agent-manager/shared';
import { Button } from '../components/ui/button.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from '../components/ui/card.js';
import { Badge } from '../components/ui/badge.js';
import { Separator } from '../components/ui/separator.js';
import { Skeleton } from '../components/ui/skeleton.js';
import { ScrollArea } from '../components/ui/scroll-area.js';
import { Input } from '../components/ui/input.js';
import { Textarea } from '../components/ui/textarea.js';
import { Label } from '../components/ui/label.js';
import { Switch } from '../components/ui/switch.js';
import { Checkbox } from '../components/ui/checkbox.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs.js';
import { Progress } from '../components/ui/progress.js';
import { Slider } from '../components/ui/slider.js';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar.js';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table.js';
import { Toggle } from '../components/ui/toggle.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip.js';
import { SessionPanel } from '../components/layout/session-panel.js';
import { AppShell, ShellNavbar, ShellStatusBar } from '../components/layout/app-shell.js';
import { Sidebar } from '../components/layout/sidebar.js';
import type { SessionInfo } from '@agent-manager/shared';
import { cn } from '@agent-manager/ui';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="space-y-4" data-testid={testId}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <Separator />
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="space-y-2" data-testid={testId}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockSkill: ClaudeSkillContract = {
  id: 'skill-commit',
  name: 'Git Commit',
  description: 'Analyzes staged changes, drafts a conventional commit message, and commits.',
  enabled: true,
  autoDiscoverable: true,
  adapterId: 'claude-code',
  triggers: [{ type: 'keyword', value: 'commit' }],
  tags: ['git', 'workflow'],
  specialization: 'claude',
  source: 'autodiscovered',
  slashCommand: 'commit',
  globs: [],
};

const mockSkillDisabled: SkillContract = {
  id: 'skill-deploy',
  name: 'Deploy to Production',
  description: 'Runs the deployment pipeline with pre-flight checks.',
  enabled: false,
  autoDiscoverable: false,
  adapterId: 'claude-code',
  triggers: [],
  tags: ['deploy', 'ci'],
};

const mockTasks: TaskContract[] = [
  {
    id: 'task-1',
    title: 'Implement authentication flow',
    description: 'Add JWT-based auth with refresh tokens and session management.',
    status: 'in_progress',
    progress: 65,
    priority: 'high',
    adapterId: 'claude-code',
    labels: ['backend', 'security'],
    subtasks: [
      { id: 'st-1', title: 'Create JWT middleware', status: 'completed' },
      { id: 'st-2', title: 'Add refresh token rotation', status: 'in_progress' },
      { id: 'st-3', title: 'Write auth tests', status: 'pending' },
    ],
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T12:30:00Z',
  },
  {
    id: 'task-2',
    title: 'Fix CSS layout overflow',
    description: 'Sidebar overflows on mobile viewports.',
    status: 'completed',
    progress: 100,
    priority: 'medium',
    adapterId: 'claude-code',
    labels: ['ui', 'bug'],
    subtasks: [],
    createdAt: '2026-02-09T08:00:00Z',
    updatedAt: '2026-02-09T09:15:00Z',
  },
  {
    id: 'task-3',
    title: 'Database migration failing',
    description: 'Schema migration script throws on PostgreSQL 16.',
    status: 'failed',
    priority: 'critical',
    adapterId: 'claude-code',
    labels: ['database'],
    subtasks: [],
    createdAt: '2026-02-10T11:00:00Z',
    updatedAt: '2026-02-10T11:05:00Z',
  },
];

const mockMcpServers: McpContract[] = [
  {
    id: 'mcp-fs',
    name: 'filesystem',
    uri: 'stdio:///usr/local/bin/mcp-fs',
    status: 'connected',
    adapterId: 'claude-code',
    tools: [
      { name: 'read_file', description: 'Read contents of a file' },
      { name: 'write_file', description: 'Write contents to a file' },
      { name: 'list_directory', description: 'List directory contents' },
    ],
    resources: [],
    prompts: [],
  },
  {
    id: 'mcp-pg',
    name: 'postgres',
    uri: 'stdio:///usr/local/bin/mcp-postgres',
    status: 'error',
    adapterId: 'claude-code',
    errorMessage: 'Connection refused on port 5432',
    tools: [{ name: 'query', description: 'Execute SQL query' }],
    resources: [],
    prompts: [],
  },
  {
    id: 'mcp-gh',
    name: 'github',
    uri: 'stdio:///usr/local/bin/mcp-github',
    status: 'connecting',
    adapterId: 'claude-code',
    tools: [],
    resources: [],
    prompts: [],
  },
];

const mockHooks: HookContract[] = [
  {
    id: 'hook-1',
    name: 'Pre-commit lint',
    event: 'pre_tool_use',
    handler: './hooks/lint.sh',
    enabled: true,
    adapterId: 'claude-code',
    description: 'Runs ESLint before any Bash commit command.',
    runCount: 42,
    lastRunAt: '2026-02-10T12:00:00Z',
    lastRunResult: 'success',
  },
  {
    id: 'hook-2',
    name: 'Post-edit format',
    event: 'post_tool_use',
    handler: './hooks/format.sh',
    enabled: true,
    adapterId: 'claude-code',
    runCount: 18,
    lastRunAt: '2026-02-10T11:45:00Z',
    lastRunResult: 'failure',
  },
  {
    id: 'hook-3',
    name: 'Session notify',
    event: 'session_end',
    handler: './hooks/notify.sh',
    enabled: false,
    adapterId: 'claude-code',
    runCount: 0,
  },
];

const mockWorktrees: WorktreeContract[] = [
  { id: 'wt-1', branch: 'main', path: '/home/user/project', repo: 'agent-manager', status: 'clean', isMain: true, changedFiles: 0, createdAt: '2026-02-01T00:00:00Z', aheadBehind: { ahead: 0, behind: 0 } },
  { id: 'wt-2', branch: 'feature/auth', path: '/home/user/project-auth', repo: 'agent-manager', status: 'dirty', isMain: false, changedFiles: 5, createdAt: '2026-02-08T10:00:00Z', aheadBehind: { ahead: 3, behind: 1 } },
  { id: 'wt-3', branch: 'fix/overflow', path: '/home/user/project-fix', repo: 'agent-manager', status: 'conflict', isMain: false, changedFiles: 2, createdAt: '2026-02-09T14:00:00Z', aheadBehind: { ahead: 1, behind: 4 } },
];

const mockDoc: ResearchDocContract = {
  id: 'doc-1',
  title: 'Authentication Architecture',
  role: 'plan',
  format: 'markdown',
  editable: false,
  adapterId: 'claude-code',
  content: '## Overview\n\nJWT-based authentication with refresh token rotation.\n\n### Flow\n1. User submits credentials\n2. Server validates and issues access + refresh tokens\n3. Access token expires after 15 minutes\n4. Refresh token used to obtain new pair',
  tags: ['auth', 'architecture', 'jwt'],
  createdAt: '2026-02-10T09:00:00Z',
  updatedAt: '2026-02-10T10:00:00Z',
};

const mockToolCall: ToolCallElement = {
  type: 'tool_call',
  id: 'tc-1',
  toolName: 'Read',
  input: { file_path: '/home/user/project/src/auth.ts' },
  output: 'import { sign, verify } from "jsonwebtoken";\n\nexport function createToken(payload: object) {\n  return sign(payload, process.env.JWT_SECRET!);\n}',
  collapsed: false,
  isError: false,
  durationMs: 12,
};

const mockToolCallError: ToolCallElement = {
  type: 'tool_call',
  id: 'tc-2',
  toolName: 'Bash',
  input: { command: 'npm run build' },
  output: 'Error: Cannot find module "./missing-dep"',
  collapsed: false,
  isError: true,
  durationMs: 3400,
};

const mockCodeBlock: CodeBlockElement = {
  type: 'code_block',
  id: 'cb-1',
  language: 'typescript',
  code: 'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}',
  filePath: 'src/utils/greet.ts',
  startLine: 1,
  actions: ['copy', 'apply'],
};

const mockCostTicker: CostTickerElement = {
  type: 'cost_ticker',
  id: 'ct-1',
  costUsd: 0.0847,
  tokensIn: 24500,
  tokensOut: 3200,
  model: 'claude-opus-4-6',
};

const mockDiff: DiffViewElement = {
  type: 'diff',
  id: 'dv-1',
  filePath: 'src/components/sidebar.tsx',
  mode: 'unified',
  hunks: [
    {
      oldStart: 10,
      oldLines: 5,
      newStart: 10,
      newLines: 7,
      content: ' import { cn } from "../utils";\n \n-function Sidebar() {\n+interface SidebarProps {\n+  collapsed?: boolean;\n+}\n+\n+function Sidebar({ collapsed }: SidebarProps) {\n   return (',
    },
  ],
  result: 'pending',
};

const mockDiffAccepted: DiffViewElement = {
  type: 'diff',
  id: 'dv-2',
  filePath: 'src/lib/api.ts',
  mode: 'unified',
  hunks: [
    {
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 3,
      content: '-const API_URL = "http://localhost:3000";\n+const API_URL = process.env.API_URL ?? "http://localhost:3000";\n \n export async function fetchData() {',
    },
  ],
  result: 'accepted',
};

const mockProgress: ProgressElement[] = [
  { type: 'progress', id: 'p-1', label: 'Installing dependencies', progress: 100, status: 'completed', details: '142 packages installed' },
  { type: 'progress', id: 'p-2', label: 'Running test suite', progress: 62, status: 'running', details: '74/120 tests passed' },
  { type: 'progress', id: 'p-3', label: 'Build production', progress: 30, status: 'failed', details: 'TypeScript compilation error' },
];

const mockSession: SessionInfo = {
  sessionId: 'demo-session-1',
  adapterId: 'claude-code',
  prompt: 'Help me refactor the authentication module to use JWT tokens',
  cwd: '/home/user/project',
  model: 'claude-opus-4-6',
  status: 'completed',
  startedAt: '2026-02-10T12:00:00Z',
  endedAt: '2026-02-10T12:05:00Z',
  costUsd: 0.0847,
  tokensIn: 24500,
  tokensOut: 3200,
  events: [
    { id: 'e1', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:00Z', type: 'session_start', model: 'claude-opus-4-6', cwd: '/home/user/project' },
    { id: 'e2', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:01Z', type: 'thinking', text: 'Let me analyze the current authentication implementation to understand what needs to be refactored...' },
    { id: 'e3', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:02Z', type: 'text_delta', text: "I'll help you refactor the authentication module. Let me start by reading the current implementation." },
    { id: 'e4', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:03Z', type: 'tool_call', toolUseId: 'tu-1', toolName: 'Read', input: { file_path: '/home/user/project/src/auth.ts' } },
    { id: 'e5', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:04Z', type: 'tool_result', toolUseId: 'tu-1', toolName: 'Read', output: 'import session from "express-session";\n\nexport function authenticate(req, res, next) {\n  if (!req.session.user) return res.status(401).send("Unauthorized");\n  next();\n}', isError: false },
    { id: 'e6', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:05Z', type: 'text_delta', text: '\n\nI see the current implementation uses express-session. Here\'s the JWT-based refactor:' },
    { id: 'e7', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:06Z', type: 'tool_call', toolUseId: 'tu-2', toolName: 'Edit', input: { file_path: '/home/user/project/src/auth.ts', old_string: 'import session from "express-session";', new_string: 'import { sign, verify } from "jsonwebtoken";' } },
    { id: 'e8', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:07Z', type: 'tool_result', toolUseId: 'tu-2', toolName: 'Edit', output: 'File updated successfully', isError: false },
    { id: 'e9', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:08Z', type: 'text_delta', text: '\n\nDone! The authentication module has been refactored to use JWT tokens.' },
    { id: 'e10', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:09Z', type: 'cost_update', costUsd: 0.0847, tokensIn: 24500, tokensOut: 3200 },
    { id: 'e11', sessionId: 'demo-session-1', timestamp: '2026-02-10T12:00:10Z', type: 'session_end', result: 'success', costUsd: 0.0847, durationMs: 10000, tokensIn: 24500, tokensOut: 3200 },
  ],
};

// Running session variant
const mockRunningSession: SessionInfo = {
  sessionId: 'demo-session-running',
  adapterId: 'claude-code',
  prompt: 'Add unit tests for the payment processing module',
  cwd: '/home/user/project',
  model: 'claude-opus-4-6',
  status: 'running',
  startedAt: '2026-02-10T14:00:00Z',
  costUsd: 0.0312,
  tokensIn: 8500,
  tokensOut: 1200,
  events: [
    { id: 'r1', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:00Z', type: 'session_start', model: 'claude-opus-4-6', cwd: '/home/user/project' },
    { id: 'r2', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:01Z', type: 'thinking', text: 'I need to examine the payment processing module to understand what tests to write...' },
    { id: 'r3', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:02Z', type: 'text_delta', text: "I'll write comprehensive unit tests for the payment module. Let me first look at the existing code." },
    { id: 'r4', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:03Z', type: 'tool_call', toolUseId: 'tu-r1', toolName: 'Read', input: { file_path: '/home/user/project/src/payments.ts' } },
    { id: 'r5', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:04Z', type: 'tool_result', toolUseId: 'tu-r1', toolName: 'Read', output: 'export async function processPayment(amount: number, currency: string) {\n  const result = await stripe.charges.create({ amount, currency });\n  return { id: result.id, status: result.status };\n}', isError: false },
    { id: 'r6', sessionId: 'demo-session-running', timestamp: '2026-02-10T14:00:05Z', type: 'text_delta', text: '\n\nI can see the payment module uses Stripe. Let me write tests covering success and failure scenarios:' },
  ],
};

// Session summaries for sidebar list
const mockSessionSummaries: SessionSummary[] = [
  { sessionId: 'demo-session-running', adapterId: 'claude-code', prompt: 'Add unit tests for the payment processing module', status: 'running', startedAt: '2026-02-10T14:00:00Z', costUsd: 0.0312, eventCount: 6, cwd: '/home/user/project', tokensIn: 8500, tokensOut: 1200 },
  { sessionId: 'demo-session-1', adapterId: 'claude-code', prompt: 'Help me refactor the authentication module to use JWT tokens', status: 'completed', startedAt: '2026-02-10T12:00:00Z', endedAt: '2026-02-10T12:05:00Z', costUsd: 0.0847, eventCount: 11, cwd: '/home/user/project', tokensIn: 24500, tokensOut: 3200 },
  { sessionId: 'demo-session-3', adapterId: 'claude-code', prompt: 'Fix the database connection pool leak', status: 'failed', startedAt: '2026-02-10T10:30:00Z', endedAt: '2026-02-10T10:31:00Z', costUsd: 0.0023, eventCount: 4, cwd: '/home/user/project', tokensIn: 1200, tokensOut: 300 },
  { sessionId: 'demo-session-4', adapterId: 'claude-code', prompt: 'Set up CI/CD pipeline with GitHub Actions', status: 'completed', startedAt: '2026-02-09T16:00:00Z', endedAt: '2026-02-09T16:20:00Z', costUsd: 0.2145, eventCount: 38, cwd: '/home/user/project', tokensIn: 62000, tokensOut: 8400 },
  { sessionId: 'demo-session-5', adapterId: 'aider', prompt: 'Migrate from Express to Hono framework', status: 'starting', startedAt: '2026-02-10T14:05:00Z', costUsd: 0, eventCount: 0, cwd: '/home/user/project', tokensIn: 0, tokensOut: 0 },
];

// ---------------------------------------------------------------------------
// Mock inline sidebar for high-level screens (avoids store dependencies)
// ---------------------------------------------------------------------------

function MockSidebarContent({
  sessions,
  activeSessionId,
  onSelectSession,
}: {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  const statusColors: Record<string, string> = {
    starting: 'bg-amber-500',
    running: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    interrupted: 'bg-muted-foreground',
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">Agent Manager</h1>
        <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions</h2>
        </div>
        <div className="space-y-0.5 px-2">
          {sessions.map((session) => (
            <button
              key={session.sessionId}
              onClick={() => onSelectSession(session.sessionId)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                session.sessionId === activeSessionId
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', statusColors[session.status] ?? 'bg-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{session.prompt}</div>
                <div className="text-xs text-muted-foreground">${session.costUsd.toFixed(4)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock detail panel content for 3-panel layout
// ---------------------------------------------------------------------------

function MockDetailContent() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Session Details</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks</h3>
          <div className="mt-2 space-y-2">
            {mockTasks.slice(0, 2).map((task) => (
              <TaskCard key={task.id} task={task} compact />
            ))}
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost</h3>
          <div className="mt-2">
            <CostTicker element={{ type: 'cost_ticker', id: 'detail-cost', costUsd: 0.0847, tokensIn: 24500, tokensOut: 3200 }} />
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">MCP Servers</h3>
          <div className="mt-2 space-y-1">
            {mockMcpServers.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={cn('h-1.5 w-1.5 rounded-full', s.status === 'connected' ? 'bg-green-500' : s.status === 'error' ? 'bg-red-500' : 'bg-amber-500')} />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock navbar for high-level screen snapshots
// ---------------------------------------------------------------------------

function MockNavbar({ layoutLabel }: { layoutLabel?: string }) {
  const navItems = ['Ops', 'Sessions', 'Settings'];
  return (
    <ShellNavbar
      leading={
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-foreground">Agent Manager</span>
          <div className="ml-2 h-2 w-2 rounded-full bg-green-500" />
          {layoutLabel && (
            <Badge variant="outline" className="ml-2 text-[10px]">{layoutLabel}</Badge>
          )}
        </div>
      }
      trailing={
        <div className="flex items-center gap-1">
          {navItems.map((label) => (
            <span
              key={label}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors',
                label === 'Ops' && 'bg-accent text-accent-foreground',
              )}
            >
              {label}
            </span>
          ))}
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Mock status bar for high-level screens
// ---------------------------------------------------------------------------

function MockStatusBar() {
  return (
    <ShellStatusBar>
      <span>2 agents connected</span>
      <span className="text-border">|</span>
      <span>5 sessions</span>
      <span className="text-border">|</span>
      <span>3 MCP servers</span>
      <span className="flex-1" />
      <span>v0.1.0</span>
    </ShellStatusBar>
  );
}

// ---------------------------------------------------------------------------
// Mock empty main content (new session form)
// ---------------------------------------------------------------------------

function MockEmptyMain() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-md">
        <h2 className="mb-4 text-lg font-semibold text-foreground">New Session</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Agent</label>
            <div className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground">claude-code</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Working Directory</label>
            <div className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground">/path/to/project</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Prompt</label>
            <div className="mt-1 h-20 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground">Describe the task...</div>
          </div>
          <div className="w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">Start Session</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Snapshot page component
// ---------------------------------------------------------------------------

export function SnapshotsPage() {
  const [selectedMcp, setSelectedMcp] = useState('mcp-fs');
  const [selectedWorktree, setSelectedWorktree] = useState('wt-1');

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-4xl space-y-10 p-6 pb-20">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Component Snapshots</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visual showcase of every component with sample data
          </p>
        </div>

        {/* ============================================================= */}
        {/* HIGH-LEVEL SCREENS — Full app shell layouts                   */}
        {/* ============================================================= */}
        <Section title="App Shell — High-Level Screens" testId="section-app-shell">

          {/* ---- 1. Sidebar + Chat (Running Session) ---- */}
          <SubSection title="Sidebar + Chat — Running Session" testId="ss-shell-running">
            <div className="h-[600px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main"
                navbar={<MockNavbar layoutLabel="sidebar-main" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-running"
                    onSelectSession={() => {}}
                  />
                }
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockRunningSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 2. Sidebar + Chat (Completed Session) ---- */}
          <SubSection title="Sidebar + Chat — Completed Session" testId="ss-shell-completed">
            <div className="h-[600px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main"
                navbar={<MockNavbar layoutLabel="sidebar-main" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-1"
                    onSelectSession={() => {}}
                  />
                }
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 3. Empty State (No Session Selected) ---- */}
          <SubSection title="Sidebar + Empty State — No Session" testId="ss-shell-empty">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main"
                navbar={<MockNavbar layoutLabel="sidebar-main" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId={null}
                    onSelectSession={() => {}}
                  />
                }
                statusBar={<MockStatusBar />}
              >
                <MockEmptyMain />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 4. 3-Panel: Sidebar + Chat + Detail ---- */}
          <SubSection title="3-Panel — Sidebar + Chat + Detail" testId="ss-shell-three-panel">
            <div className="h-[600px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main-detail"
                navbar={<MockNavbar layoutLabel="sidebar-main-detail" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-1"
                    onSelectSession={() => {}}
                  />
                }
                detail={<MockDetailContent />}
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 5. Focused Mode (No Sidebar) ---- */}
          <SubSection title="Focused Mode — Chat Only" testId="ss-shell-focused">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="focused"
                navbar={<MockNavbar layoutLabel="focused" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-1"
                    onSelectSession={() => {}}
                  />
                }
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 6. Sidebar Collapsed ---- */}
          <SubSection title="Sidebar Collapsed" testId="ss-shell-collapsed">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main"
                defaultSidebarCollapsed={true}
                navbar={<MockNavbar layoutLabel="collapsed sidebar" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-1"
                    onSelectSession={() => {}}
                  />
                }
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 7. Empty Sessions (First-Time User) ---- */}
          <SubSection title="Empty State — No Sessions At All" testId="ss-shell-no-sessions">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main"
                navbar={<MockNavbar />}
                sidebar={
                  <MockSidebarContent
                    sessions={[]}
                    activeSessionId={null}
                    onSelectSession={() => {}}
                  />
                }
              >
                <MockEmptyMain />
              </AppShell>
            </div>
          </SubSection>

          {/* ---- 8. 3-Panel with Detail Collapsed ---- */}
          <SubSection title="3-Panel — Detail Collapsed" testId="ss-shell-detail-collapsed">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <AppShell
                defaultLayout="sidebar-main-detail"
                defaultDetailCollapsed={true}
                navbar={<MockNavbar layoutLabel="detail collapsed" />}
                sidebar={
                  <MockSidebarContent
                    sessions={mockSessionSummaries}
                    activeSessionId="demo-session-1"
                    onSelectSession={() => {}}
                  />
                }
                detail={<MockDetailContent />}
                statusBar={<MockStatusBar />}
              >
                <SessionPanel
                  session={mockSession}
                  onSendMessage={() => {}}
                />
              </AppShell>
            </div>
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* SHADCN PRIMITIVES */}
        {/* ============================================================= */}
        <Section title="Primitives (shadcn/ui)" testId="section-primitives">
          <SubSection title="Button" testId="ss-button">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </SubSection>

          <SubSection title="Badge" testId="ss-badge">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="ghost">Ghost</Badge>
              <Badge variant="link">Link</Badge>
            </div>
          </SubSection>

          <SubSection title="Card" testId="ss-card">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>A description of what this card represents.</CardDescription>
                <CardAction>
                  <Button variant="outline" size="sm">Action</Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card content goes here. This is a standard shadcn card component with header, content, and footer slots.
                </p>
              </CardContent>
              <CardFooter>
                <Button size="sm">Save</Button>
              </CardFooter>
            </Card>
          </SubSection>

          <SubSection title="Separator" testId="ss-separator">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Horizontal separator</p>
              <Separator />
              <div className="flex h-8 items-center gap-4">
                <span className="text-sm text-muted-foreground">Left</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-muted-foreground">Right</span>
              </div>
            </div>
          </SubSection>

          <SubSection title="Skeleton" testId="ss-skeleton">
            <div className="space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-36" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </SubSection>

          <SubSection title="ScrollArea" testId="ss-scroll-area">
            <ScrollArea className="h-32 rounded-xl border border-border bg-card p-4">
              {Array.from({ length: 20 }, (_, i) => (
                <p key={i} className="py-1 text-sm text-muted-foreground">
                  Scrollable item {i + 1}
                </p>
              ))}
            </ScrollArea>
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* SHADCN FORM & DATA COMPONENTS */}
        {/* ============================================================= */}
        <Section title="Form & Data Components (shadcn/ui)" testId="section-form">
          <SubSection title="Input" testId="ss-input">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="demo-input">Email</Label>
              <Input id="demo-input" type="email" placeholder="you@example.com" />
            </div>
          </SubSection>

          <SubSection title="Textarea" testId="ss-textarea">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="demo-textarea">Description</Label>
              <Textarea id="demo-textarea" placeholder="Write something..." />
            </div>
          </SubSection>

          <SubSection title="Checkbox & Switch" testId="ss-checkbox-switch">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="demo-check" />
                <Label htmlFor="demo-check">Accept terms</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="demo-switch" />
                <Label htmlFor="demo-switch">Notifications</Label>
              </div>
            </div>
          </SubSection>

          <SubSection title="Slider" testId="ss-slider">
            <div className="max-w-sm">
              <Slider defaultValue={[40]} max={100} step={1} />
            </div>
          </SubSection>

          <SubSection title="Progress" testId="ss-progress">
            <div className="max-w-sm space-y-2">
              <Progress value={65} />
              <p className="text-xs text-muted-foreground">65% complete</p>
            </div>
          </SubSection>

          <SubSection title="Tabs" testId="ss-tabs">
            <Tabs defaultValue="overview" className="max-w-md">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
                <TabsTrigger value="reports">Reports</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Overview content with key metrics.</p>
              </TabsContent>
              <TabsContent value="analytics" className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Analytics dashboard and charts.</p>
              </TabsContent>
              <TabsContent value="reports" className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Generated reports and exports.</p>
              </TabsContent>
            </Tabs>
          </SubSection>

          <SubSection title="Avatar" testId="ss-avatar">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
            </div>
          </SubSection>

          <SubSection title="Alert" testId="ss-alert">
            <div className="max-w-md space-y-3">
              <Alert>
                <AlertTitle>Default Alert</AlertTitle>
                <AlertDescription>This is a default informational alert.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Something went wrong during the build process.</AlertDescription>
              </Alert>
            </div>
          </SubSection>

          <SubSection title="Table" testId="ss-table">
            <div className="max-w-lg rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">session-001</TableCell>
                    <TableCell><Badge variant="secondary">running</Badge></TableCell>
                    <TableCell className="text-right">$0.0245</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">session-002</TableCell>
                    <TableCell><Badge variant="outline">completed</Badge></TableCell>
                    <TableCell className="text-right">$0.1832</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">session-003</TableCell>
                    <TableCell><Badge variant="destructive">failed</Badge></TableCell>
                    <TableCell className="text-right">$0.0047</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </SubSection>

          <SubSection title="Toggle" testId="ss-toggle">
            <div className="flex gap-2">
              <Toggle aria-label="Toggle bold">B</Toggle>
              <Toggle aria-label="Toggle italic" variant="outline">I</Toggle>
            </div>
          </SubSection>

          <SubSection title="Tooltip" testId="ss-tooltip">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Hover me</Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>This is a tooltip</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* CHAT UI (assistant-ui) */}
        {/* ============================================================= */}
        <Section title="Chat UI (assistant-ui)" testId="section-chat-ui">
          <SubSection title="SessionPanel — Full Chat Thread" testId="ss-session-panel">
            <div className="h-[500px] rounded-xl border border-border overflow-hidden">
              <SessionPanel
                session={mockSession}
                onSendMessage={(msg) => console.log('send:', msg)}
              />
            </div>
          </SubSection>

          <SubSection title="SessionPanel — Empty State" testId="ss-session-panel-empty">
            <div className="h-[200px] rounded-xl border border-border overflow-hidden">
              <SessionPanel session={null} />
            </div>
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* CONCEPT COMPONENTS */}
        {/* ============================================================= */}
        <Section title="Concept Components" testId="section-concepts">
          <SubSection title="SkillCard" testId="ss-skill-card">
            <div className="grid gap-3 sm:grid-cols-2">
              <SkillCard
                skill={mockSkill}
                onActivate={(id) => console.log('activate', id)}
              />
              <SkillCard skill={mockSkillDisabled} />
            </div>
          </SubSection>

          <SubSection title="TaskCard" testId="ss-task-card">
            <div className="space-y-3">
              {mockTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={(id) => console.log('select task', id)}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Compact variant:</p>
            <div className="space-y-2">
              {mockTasks.map((task) => (
                <TaskCard key={task.id} task={task} compact />
              ))}
            </div>
          </SubSection>

          <SubSection title="McpBrowser" testId="ss-mcp-browser">
            <McpBrowser
              servers={mockMcpServers}
              selectedServerId={selectedMcp}
              onSelectServer={setSelectedMcp}
            />
          </SubSection>

          <SubSection title="HookConfigPanel" testId="ss-hook-config">
            <HookConfigPanel
              hooks={mockHooks}
              onToggle={(id, enabled) => console.log('toggle', id, enabled)}
            />
          </SubSection>

          <SubSection title="WorktreeSelector" testId="ss-worktree">
            <WorktreeSelector
              worktrees={mockWorktrees}
              selectedId={selectedWorktree}
              onSelect={setSelectedWorktree}
            />
          </SubSection>

          <SubSection title="ResearchDocViewer" testId="ss-research-doc">
            <ResearchDocViewer doc={mockDoc} />
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* CHAT ELEMENTS */}
        {/* ============================================================= */}
        <Section title="Chat Elements" testId="section-chat-elements">
          <SubSection title="ToolCallViewer" testId="ss-tool-call">
            <div className="space-y-3">
              <ToolCallViewer element={mockToolCall} />
              <ToolCallViewer element={mockToolCallError} />
            </div>
          </SubSection>

          <SubSection title="CodeBlock" testId="ss-code-block">
            <CodeBlock
              element={mockCodeBlock}
              onApply={(id) => console.log('apply', id)}
            />
          </SubSection>

          <SubSection title="CostTicker" testId="ss-cost-ticker">
            <div className="flex flex-wrap gap-3">
              <CostTicker element={mockCostTicker} />
              <CostTicker
                element={{
                  type: 'cost_ticker',
                  id: 'ct-2',
                  costUsd: 2.15,
                  tokensIn: 1_250_000,
                  tokensOut: 180_000,
                }}
              />
            </div>
          </SubSection>

          <SubSection title="DiffView" testId="ss-diff-view">
            <div className="space-y-3">
              <DiffView
                element={mockDiff}
                onAccept={(id) => console.log('accept', id)}
                onReject={(id) => console.log('reject', id)}
              />
              <DiffView element={mockDiffAccepted} />
            </div>
          </SubSection>

          <SubSection title="ProgressIndicator" testId="ss-progress-indicator">
            <div className="space-y-3">
              {mockProgress.map((p) => (
                <ProgressIndicator key={p.id} element={p} />
              ))}
            </div>
          </SubSection>
        </Section>
      </div>
    </ScrollArea>
  );
}
