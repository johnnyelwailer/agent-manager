import { useState } from 'react';
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

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <Separator />
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
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
        {/* SHADCN PRIMITIVES */}
        {/* ============================================================= */}
        <Section title="Primitives (shadcn/ui)">
          <SubSection title="Button">
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

          <SubSection title="Badge">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="ghost">Ghost</Badge>
              <Badge variant="link">Link</Badge>
            </div>
          </SubSection>

          <SubSection title="Card">
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

          <SubSection title="Separator">
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

          <SubSection title="Skeleton">
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

          <SubSection title="ScrollArea">
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
        <Section title="Form & Data Components (shadcn/ui)">
          <SubSection title="Input">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="demo-input">Email</Label>
              <Input id="demo-input" type="email" placeholder="you@example.com" />
            </div>
          </SubSection>

          <SubSection title="Textarea">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="demo-textarea">Description</Label>
              <Textarea id="demo-textarea" placeholder="Write something..." />
            </div>
          </SubSection>

          <SubSection title="Checkbox & Switch">
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

          <SubSection title="Slider">
            <div className="max-w-sm">
              <Slider defaultValue={[40]} max={100} step={1} />
            </div>
          </SubSection>

          <SubSection title="Progress">
            <div className="max-w-sm space-y-2">
              <Progress value={65} />
              <p className="text-xs text-muted-foreground">65% complete</p>
            </div>
          </SubSection>

          <SubSection title="Tabs">
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

          <SubSection title="Avatar">
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

          <SubSection title="Alert">
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

          <SubSection title="Table">
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

          <SubSection title="Toggle">
            <div className="flex gap-2">
              <Toggle aria-label="Toggle bold">B</Toggle>
              <Toggle aria-label="Toggle italic" variant="outline">I</Toggle>
            </div>
          </SubSection>

          <SubSection title="Tooltip">
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
        {/* CONCEPT COMPONENTS */}
        {/* ============================================================= */}
        <Section title="Concept Components">
          <SubSection title="SkillCard">
            <div className="grid gap-3 sm:grid-cols-2">
              <SkillCard
                skill={mockSkill}
                onActivate={(id) => console.log('activate', id)}
              />
              <SkillCard skill={mockSkillDisabled} />
            </div>
          </SubSection>

          <SubSection title="TaskCard">
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

          <SubSection title="McpBrowser">
            <McpBrowser
              servers={mockMcpServers}
              selectedServerId={selectedMcp}
              onSelectServer={setSelectedMcp}
            />
          </SubSection>

          <SubSection title="HookConfigPanel">
            <HookConfigPanel
              hooks={mockHooks}
              onToggle={(id, enabled) => console.log('toggle', id, enabled)}
            />
          </SubSection>

          <SubSection title="WorktreeSelector">
            <WorktreeSelector
              worktrees={mockWorktrees}
              selectedId={selectedWorktree}
              onSelect={setSelectedWorktree}
            />
          </SubSection>

          <SubSection title="ResearchDocViewer">
            <ResearchDocViewer doc={mockDoc} />
          </SubSection>
        </Section>

        {/* ============================================================= */}
        {/* CHAT ELEMENTS */}
        {/* ============================================================= */}
        <Section title="Chat Elements">
          <SubSection title="ToolCallViewer">
            <div className="space-y-3">
              <ToolCallViewer element={mockToolCall} />
              <ToolCallViewer element={mockToolCallError} />
            </div>
          </SubSection>

          <SubSection title="CodeBlock">
            <CodeBlock
              element={mockCodeBlock}
              onApply={(id) => console.log('apply', id)}
            />
          </SubSection>

          <SubSection title="CostTicker">
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

          <SubSection title="DiffView">
            <div className="space-y-3">
              <DiffView
                element={mockDiff}
                onAccept={(id) => console.log('accept', id)}
                onReject={(id) => console.log('reject', id)}
              />
              <DiffView element={mockDiffAccepted} />
            </div>
          </SubSection>

          <SubSection title="ProgressIndicator">
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
