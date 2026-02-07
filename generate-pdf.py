#!/usr/bin/env python3
"""
Generate a comprehensive PDF showcasing all Universal Agent Host UI variants.
Includes screenshots, explanations, and comparative analysis.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from PIL import Image as PILImage

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SS_DIR = os.path.join(os.path.dirname(__file__), 'screenshots', 'screenshots.spec.ts')
OUT_PDF = os.path.join(os.path.dirname(__file__), 'variant-showcase.pdf')
PAGE_W, PAGE_H = A4  # 595 x 842 pt

# Colors
C_BG       = HexColor('#09090b')
C_SURFACE  = HexColor('#18181b')
C_BORDER   = HexColor('#27272a')
C_TEXT     = HexColor('#e4e4e7')
C_MUTED    = HexColor('#a1a1aa')
C_ACCENT   = HexColor('#7c3aed')
C_EMERALD  = HexColor('#10b981')
C_AMBER    = HexColor('#f59e0b')
C_WHITE    = HexColor('#ffffff')
C_BLACK    = HexColor('#000000')

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------

sTitle = ParagraphStyle('Title', fontName='Helvetica-Bold', fontSize=28,
                        textColor=C_ACCENT, spaceAfter=4*mm, alignment=TA_LEFT)
sSubtitle = ParagraphStyle('Subtitle', fontName='Helvetica', fontSize=13,
                           textColor=C_MUTED, spaceAfter=12*mm, alignment=TA_LEFT)
sH1 = ParagraphStyle('H1', fontName='Helvetica-Bold', fontSize=22,
                      textColor=C_ACCENT, spaceBefore=6*mm, spaceAfter=4*mm)
sH2 = ParagraphStyle('H2', fontName='Helvetica-Bold', fontSize=16,
                      textColor=HexColor('#e4e4e7'), spaceBefore=5*mm, spaceAfter=3*mm)
sH3 = ParagraphStyle('H3', fontName='Helvetica-Bold', fontSize=12,
                      textColor=HexColor('#a1a1aa'), spaceBefore=3*mm, spaceAfter=2*mm)
sBody = ParagraphStyle('Body', fontName='Helvetica', fontSize=10,
                        textColor=HexColor('#71717a'), leading=14, spaceAfter=2*mm,
                        alignment=TA_JUSTIFY)
sCaption = ParagraphStyle('Caption', fontName='Helvetica-Oblique', fontSize=8.5,
                           textColor=HexColor('#52525b'), alignment=TA_CENTER,
                           spaceBefore=1*mm, spaceAfter=4*mm)
sLabel = ParagraphStyle('Label', fontName='Helvetica-Bold', fontSize=9,
                         textColor=C_ACCENT, spaceAfter=1*mm)
sBullet = ParagraphStyle('Bullet', fontName='Helvetica', fontSize=9.5,
                          textColor=HexColor('#71717a'), leading=13,
                          leftIndent=12, bulletIndent=4, spaceAfter=1*mm)
sTableHeader = ParagraphStyle('TH', fontName='Helvetica-Bold', fontSize=8.5,
                               textColor=C_WHITE, alignment=TA_CENTER)
sTableCell = ParagraphStyle('TC', fontName='Helvetica', fontSize=8,
                             textColor=HexColor('#d4d4d8'), alignment=TA_CENTER,
                             leading=10)
sTableCellL = ParagraphStyle('TCL', fontName='Helvetica-Bold', fontSize=8.5,
                              textColor=HexColor('#e4e4e7'), leading=10)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def ss(name):
    """Return path to a screenshot."""
    return os.path.join(SS_DIR, name)


def fit_image(path, max_w, max_h=None):
    """Create an Image flowable that fits within max_w (and optionally max_h)."""
    if not os.path.exists(path):
        return Paragraph(f'<i>[missing: {os.path.basename(path)}]</i>', sCaption)
    img = PILImage.open(path)
    w, h = img.size
    scale = max_w / w
    new_w = max_w
    new_h = h * scale
    if max_h and new_h > max_h:
        scale2 = max_h / new_h
        new_w *= scale2
        new_h = max_h
    return Image(path, width=new_w, height=new_h)


def hr():
    return HRFlowable(width='100%', thickness=0.5, color=C_BORDER, spaceBefore=4*mm, spaceAfter=4*mm)


def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', sBullet)


CONTENT_W = PAGE_W - 30*mm  # 15mm margins each side
IMG_FULL_W = CONTENT_W
IMG_HALF_W = (CONTENT_W - 4*mm) / 2
IMG_COMPONENT_W = CONTENT_W * 0.75


# ---------------------------------------------------------------------------
# Variant Data
# ---------------------------------------------------------------------------

VARIANTS = [
    # ── Main Variants ──────────────────────────────────────────────
    {
        'id': 'agent-os',
        'name': 'AgentOS',
        'category': 'Main Variants',
        'tagline': 'Native Desktop IDE for AI Agent Orchestration',
        'layout': 'Three-column sidebar + main content area with tabbed views',
        'description': (
            'AgentOS brings a native desktop IDE feel to agent management. A semantic sidebar '
            'navigator acts as a "lens" for viewing different contexts within the strategy tree, '
            'while the main area hosts a task board with drag-and-drop columns and a plan view '
            'for hierarchical strategy decomposition. The bottom console provides real-time agent '
            'log streaming with a magic input bar for natural language commands.'
        ),
        'reasoning': (
            'Designed for power users who need simultaneous visibility into strategy, execution, '
            'and agent output. The IDE metaphor is familiar to developers and supports deep focus '
            'work. The sidebar-main-console layout maximizes information density while maintaining '
            'clear separation of concerns.'
        ),
        'key_components': [
            'Semantic sidebar with strategy/context/agent navigation',
            'Task board with queued/running/review/done columns',
            'Plan view with hierarchical strategy tree',
            'Real-time agent console with streaming logs',
            'Magic input bar for natural language commands',
            'Generative widget for AI-powered suggestions',
        ],
        'screenshots': {
            'Full Page \u2014 Task Board': 'agent-os-taskboard-full.png',
            'Full Page \u2014 Plan View': 'agent-os-planview-full.png',
            'Sidebar Navigator': 'agent-os-sidebar.png',
            'Task Board': 'agent-os-taskboard.png',
            'Agent Console': 'agent-os-console.png',
            'Plan View': 'agent-os-planview.png',
            'Generative Widget': 'agent-os-gen-widget.png',
            'Magic Input': 'agent-os-magic-input.png',
        },
    },
    {
        'id': 'hive',
        'name': 'Hive',
        'category': 'Main Variants',
        'tagline': 'Agent-Centric Kanban with Trust Level Management',
        'layout': 'Horizontal agent columns with trust-level cycling',
        'description': (
            'Hive organizes work by agent rather than by stage. Each agent gets a dedicated column '
            'showing their active and queued executions, with real-time status indicators and token '
            'usage tracking. The trust-level badge system lets operators cycle agents between '
            'Autonomous, Supervised, and Manual modes with a single click.'
        ),
        'reasoning': (
            'When managing multiple AI agents, the key question is often "what is each agent doing?" '
            'rather than "what stage is each task in?" Hive answers this by making agents the primary '
            'axis. The trust-level system addresses a core concern in agentic workflows: controlling '
            'how much autonomy each agent has.'
        ),
        'key_components': [
            'Per-agent columns with status badges',
            'Trust-level cycling (Autonomous \u2192 Supervised \u2192 Manual)',
            'Token usage tracking per agent',
            'Execution cards with status indicators',
            'Unassigned task overflow column',
        ],
        'screenshots': {
            'Full Page': 'hive-full.png',
            'Running Agent Column': 'hive-agent-running.png',
            'Idle Agent Column': 'hive-agent-idle.png',
            'Unassigned Column': 'hive-unassigned.png',
            'Trust Badge \u2014 Autonomous': 'hive-trust-autonomous.png',
            'Trust Badge \u2014 Supervised': 'hive-trust-supervised.png',
        },
    },
    {
        'id': 'pipeline',
        'name': 'Pipeline',
        'category': 'Main Variants',
        'tagline': 'Stage-Gate Workflow with Human Review Checkpoints',
        'layout': 'Horizontal pipeline with 5 sequential stages connected by arrows',
        'description': (
            'Pipeline models work as a sequential flow: Backlog \u2192 Dispatched \u2192 Working \u2192 '
            'Review Gate \u2192 Done. The review gate is a dedicated human checkpoint where tasks pause '
            'for approval, rejection, or change requests. Each stage shows item counts, and the '
            'footer provides aggregate statistics including cost tracking.'
        ),
        'reasoning': (
            'Many organizations require human-in-the-loop checkpoints before AI-generated work '
            'can be merged or deployed. Pipeline makes this review gate a first-class concept rather '
            'than an afterthought. The linear flow is intuitive for teams transitioning from '
            'traditional CI/CD pipeline thinking.'
        ),
        'key_components': [
            'Five sequential pipeline stages with connector arrows',
            'Review gate with approve/reject/request-changes actions',
            'Diff preview for code changes under review',
            'Cost tracking per execution and aggregate',
            'Dispatch and retry actions',
        ],
        'screenshots': {
            'Full Page': 'pipeline-full.png',
            'Backlog Stage': 'pipeline-backlog.png',
            'Working Stage': 'pipeline-working.png',
            'Review Gate': 'pipeline-review.png',
            'Review Card Detail': 'pipeline-review-card.png',
            'Done Stage': 'pipeline-done.png',
        },
    },
    {
        'id': 'nerve-center',
        'name': 'Nerve Center',
        'category': 'Main Variants',
        'tagline': 'Real-Time Monitoring & Intervention Dashboard',
        'layout': 'Multi-panel monitoring dashboard with metrics bar, fleet view, and alert system',
        'description': (
            'Nerve Center is built for observation and rapid intervention. A metrics bar provides '
            'at-a-glance KPIs, the agent fleet panel shows real-time status of all agents, and '
            'the verification wall displays all quality gates across tasks. The attention queue '
            'surfaces items requiring human action, while the alert bar provides system-level '
            'notifications.'
        ),
        'reasoning': (
            'As the number of concurrent agents grows, operators need a "mission control" view '
            'that surfaces anomalies and intervention points. Nerve Center prioritizes monitoring '
            'over interaction, making it ideal for oversight roles or when managing large fleets '
            'of agents across multiple projects.'
        ),
        'key_components': [
            'Real-time metrics bar with KPI cards',
            'Agent fleet status panel',
            'Verification wall showing all quality gates',
            'Execution timeline with temporal view',
            'Attention queue for items needing action',
            'System alert bar',
        ],
        'screenshots': {
            'Full Page': 'nerve-center-full.png',
            'Metrics Bar': 'nerve-center-metrics.png',
            'Agent Fleet': 'nerve-center-fleet.png',
            'Verification Wall': 'nerve-center-verifications.png',
            'Execution Timeline': 'nerve-center-timeline.png',
            'Attention Queue': 'nerve-center-attention.png',
            'Alert Bar': 'nerve-center-alerts.png',
        },
    },
    {
        'id': 'mosaic',
        'name': 'Mosaic',
        'category': 'Main Variants',
        'tagline': 'Strategic Overview Radiator with 8 Information Cards',
        'layout': 'Responsive card grid (2\u00d74 or 3-column) with dense information tiles',
        'description': (
            'Mosaic presents eight information cards in a dense grid: Strategy progress, Agent fleet, '
            'Active work, Review queue, Verification matrix, Cost breakdown, File activity, and '
            'Context library. Each card is a self-contained widget providing a specific analytical '
            'lens on the system state.'
        ),
        'reasoning': (
            'Information radiators work well in team settings where a dashboard is displayed on a '
            'shared screen. Mosaic\'s card-based approach means each team member can quickly scan '
            'the area they care about. The 8-card layout covers the full spectrum from strategy '
            'to cost to code changes.'
        ),
        'key_components': [
            'Strategy progress card with completion tracking',
            'Agent fleet card with status badges',
            'Active work card with running executions',
            'Review queue with pending items',
            'Verification matrix (pass/fail grid)',
            'Cost breakdown with per-execution costs',
            'File activity showing recent changes',
            'Context library with knowledge artifacts',
        ],
        'screenshots': {
            'Full Page': 'mosaic-full.png',
            'Header': 'mosaic-header.png',
            'Strategy Card': 'mosaic-strategy.png',
            'Agent Fleet Card': 'mosaic-agents.png',
            'Active Work Card': 'mosaic-active.png',
            'Review Queue': 'mosaic-reviews.png',
            'Verification Matrix': 'mosaic-verifications.png',
            'Cost Breakdown': 'mosaic-cost.png',
            'File Activity': 'mosaic-files.png',
            'Context Library': 'mosaic-context.png',
        },
    },
    {
        'id': 'command-center',
        'name': 'Command Center',
        'category': 'Main Variants',
        'tagline': 'Unified 5-Panel Operational Command Interface',
        'layout': 'Header bar + symmetric 5-panel grid',
        'description': (
            'Command Center divides the screen into five equal-weight panels: Agent Panel, Strategy '
            'Tree, Execution Log, Verification Panel, and Context Panel. A header bar with a system '
            'clock emphasizes real-time operation. Each panel provides deep access to one aspect of '
            'the system.'
        ),
        'reasoning': (
            'The symmetric grid ensures no single data type dominates, making Command Center ideal '
            'for operators who need equal access to all system facets. The real-time clock and '
            'operational aesthetics make it suited for environments where continuous monitoring is '
            'the norm.'
        ),
        'key_components': [
            'Header with system clock',
            'Agent panel with status and capabilities',
            'Strategy tree with hierarchical decomposition',
            'Execution log with real-time streaming',
            'Verification panel with quality gate status',
            'Context panel with knowledge artifacts',
        ],
        'screenshots': {
            'Full Page': 'command-center-full.png',
            'Agent Panel': 'command-center-agent-panel.png',
            'Strategy Tree': 'command-center-strategy-tree.png',
            'Execution Log': 'command-center-execution-log.png',
            'Verification Panel': 'command-center-verification-panel.png',
            'Context Panel': 'command-center-context-panel.png',
        },
    },
    {
        'id': 'flow',
        'name': 'Flow',
        'category': 'Main Variants',
        'tagline': 'Narrative Vertical Scroll with Sequential Information Flow',
        'layout': 'Single-column vertical scroll with stacked sections',
        'description': (
            'Flow presents information as a narrative journey: Summary Ribbon at the top, followed '
            'by Strategy Roadmap, Active Work, Recent Activity, Knowledge Base, and Verification '
            'Status. The linear layout encourages top-to-bottom reading and works well on both '
            'desktop and narrower viewports.'
        ),
        'reasoning': (
            'Not all users want a dense multi-panel dashboard. Flow caters to those who prefer '
            'a reading-oriented experience where context builds progressively. It\'s particularly '
            'effective for status updates and async reviews where someone needs to quickly catch up '
            'on what happened.'
        ),
        'key_components': [
            'Summary ribbon with key metrics',
            'Strategy roadmap with progress bars',
            'Active work section with running tasks',
            'Recent activity feed',
            'Knowledge base with context artifacts',
            'Verification status overview',
        ],
        'screenshots': {
            'Full Page': 'flow-full.png',
            'Summary Ribbon': 'flow-summary-ribbon.png',
            'Strategy Roadmap': 'flow-strategy-roadmap.png',
            'Active Work': 'flow-active-work.png',
            'Recent Activity': 'flow-recent-activity.png',
            'Knowledge Base': 'flow-knowledge-base.png',
            'Verification Status': 'flow-verification-status.png',
        },
    },
    {
        'id': 'spatial',
        'name': 'Spatial',
        'category': 'Main Variants',
        'tagline': 'Graph-Based Canvas for Entity Relationship Mapping',
        'layout': 'Free-form 2D canvas with interactive nodes and edges',
        'description': (
            'Spatial maps strategies, executions, verifications, contexts, and agents as nodes on a '
            '2D canvas, connected by colored edges that represent relationships. Clicking a node '
            'opens a detail sidebar with full information. This approach reveals hidden relationships '
            'and dependencies that tabular views miss.'
        ),
        'reasoning': (
            'Complex agentic workflows involve many interconnected entities. Spatial visualization '
            'helps operators discover unexpected dependencies, bottlenecks, and clusters. The '
            'interactive canvas supports exploratory analysis that structured layouts cannot.'
        ),
        'key_components': [
            'Interactive 2D canvas with positioned nodes',
            'Five node types: strategy, execution, verification, context, agent',
            'Color-coded edges showing relationships',
            'Click-to-select with detail sidebar',
            'Status-colored node indicators',
        ],
        'screenshots': {
            'Full Page': 'spatial-full.png',
            'Canvas Area': 'spatial-canvas.png',
            'With Detail Sidebar': 'spatial-with-sidebar.png',
            'Detail Sidebar Content': 'spatial-detail-sidebar.png',
        },
    },

    # ── Startup Variants ──────────────────────────────────────────
    {
        'id': 'startup-chat',
        'name': 'Startup: Chat',
        'category': 'Startup Variants',
        'tagline': 'Chat-First Interface with Quick Action Chips',
        'layout': 'Centered chat interface with action chips and recent work sidebar',
        'description': (
            'The Chat startup presents a clean, centered input field with a greeting and quick-action '
            'chips (Plan, Review, Refactor, Debug, Deploy). Recent tasks are shown below for context. '
            'This pattern mirrors popular AI chat interfaces, making it immediately familiar.'
        ),
        'reasoning': (
            'For users who think in terms of conversations rather than dashboards, a chat-first '
            'interface lowers the barrier to starting work. Action chips provide discoverability '
            'for common operations without requiring users to know command syntax.'
        ),
        'key_components': [
            'Centered hero area with greeting',
            'Quick action chips for common operations',
            'Chat input with rich text support',
            'Recent tasks list for context',
        ],
        'screenshots': {
            'Full Page': 'startup-chat-full.png',
            'Hero Area': 'startup-chat-hero.png',
            'Action Chips': 'startup-chat-actions.png',
            'Chat Input': 'startup-chat-input.png',
            'Recent Tasks': 'startup-chat-recent.png',
        },
    },
    {
        'id': 'startup-dashboard',
        'name': 'Startup: Dashboard',
        'category': 'Startup Variants',
        'tagline': 'Status Overview with Quick Actions',
        'layout': 'Welcome header + card grid with tasks, agents, strategy, and actions',
        'description': (
            'The Dashboard startup provides an at-a-glance overview of the current state: recent tasks, '
            'agent activity, strategy progress, and quick action buttons. It\'s designed as a "home base" '
            'that helps users decide what to do next based on the current system state.'
        ),
        'reasoning': (
            'Returning users need context before diving in. The dashboard answers "what happened while '
            'I was away?" and "what should I do next?" in a single glance. Quick actions reduce the '
            'clicks needed to start common workflows.'
        ),
        'key_components': [
            'Welcome header with personalized greeting',
            'Recent tasks with status indicators',
            'Agent activity summary',
            'Strategy progress with completion bars',
            'Quick action buttons',
        ],
        'screenshots': {
            'Full Page': 'startup-dashboard-full.png',
            'Welcome Header': 'startup-dashboard-welcome.png',
            'Recent Tasks': 'startup-dashboard-tasks.png',
            'Agent Activity': 'startup-dashboard-agents.png',
            'Strategy Progress': 'startup-dashboard-strategy.png',
            'Quick Actions': 'startup-dashboard-actions.png',
        },
    },
    {
        'id': 'startup-command',
        'name': 'Startup: Command',
        'category': 'Startup Variants',
        'tagline': 'Raycast/Spotlight-Style Command Palette',
        'layout': 'Centered command input with results list and keyboard hints',
        'description': (
            'The Command startup mimics Raycast or Spotlight: a focused search/command input with '
            'filterable results and keyboard shortcuts (Ctrl+1 through Ctrl+5). Recent items and '
            'available actions are shown below the input for quick access.'
        ),
        'reasoning': (
            'Power users prefer keyboard-driven workflows over mouse navigation. The command palette '
            'pattern is proven in tools like VS Code, Raycast, and Spotlight. It provides the fastest '
            'path from intent to action for experienced users.'
        ),
        'key_components': [
            'Centered command input with search',
            'Filterable results panel',
            'Keyboard shortcuts for quick actions',
            'Keyboard hints footer',
        ],
        'screenshots': {
            'Full Page': 'startup-command-full.png',
            'Command Input': 'startup-command-input.png',
            'Results Panel': 'startup-command-results.png',
            'Keyboard Hints': 'startup-command-hints.png',
        },
    },
    {
        'id': 'startup-brief',
        'name': 'Startup: Brief',
        'category': 'Startup Variants',
        'tagline': 'Mission Briefing with Chat Sidebar',
        'layout': 'Two-column: briefing content (left) + chat panel (right)',
        'description': (
            'The Brief startup presents a "mission briefing" with session summary, attention items, '
            'strategy progress, and quick actions on the left, with a chat sidebar on the right '
            'for immediate conversation. It combines the dashboard and chat approaches.'
        ),
        'reasoning': (
            'The mission briefing metaphor sets a tone of intentionality: users review the state of '
            'affairs before giving orders. The chat sidebar means they can immediately act on what '
            'they see without navigating away. This dual-panel approach serves both analytical and '
            'conversational work styles.'
        ),
        'key_components': [
            'Session summary with key statistics',
            'Attention section with items requiring action',
            'Strategy progress overview',
            'Quick action buttons',
            'Chat sidebar for immediate interaction',
        ],
        'screenshots': {
            'Full Page': 'startup-brief-full.png',
            'Brief Content': 'startup-brief-content.png',
            'Session Summary': 'startup-brief-summary.png',
            'Attention Section': 'startup-brief-attention.png',
            'Strategy Progress': 'startup-brief-strategy.png',
            'Quick Actions': 'startup-brief-actions.png',
            'Chat Panel': 'startup-brief-chat.png',
        },
    },

    # ── Workflow Variants ──────────────────────────────────────────
    {
        'id': 'ops',
        'name': 'Ops',
        'category': 'Workflow Variants',
        'tagline': 'Focused Task Manager Bridging Dev Workflow',
        'layout': 'Two-panel: issue list (left) + detail view (right) with plan, tasks, and verification pipeline',
        'description': (
            'Ops is a workflow-oriented task manager built on a new type system that models real '
            'development workflows: Projects contain Issues (linked to Jira/DevOps), Issues have '
            'Plans with steps, Plans produce Tasks assigned to agents, and each Task goes through '
            'a 4-stage verification pipeline (Prechecks \u2192 AI Review \u2192 PR \u2192 Approval). '
            'The left panel lists issues grouped by status with icons and priority indicators. '
            'The right panel shows full detail including the plan, tasks with agent assignments, '
            'and the verification pipeline visualization.'
        ),
        'reasoning': (
            'Previous variants used abstract primitives (Context, Strategy, Execution) that didn\'t '
            'map to how developers actually think about work. Ops bridges this gap by using '
            'familiar concepts: issues, plans, tasks, PRs, and reviews. The verification pipeline '
            'is the key innovation \u2014 bundling lint/types/tests/build into a single Prechecks gate, '
            'then adding AI Review, PR creation, and human Approval as distinct stages that each '
            'provide meaningful checkpoints.'
        ),
        'key_components': [
            'Issue list grouped by status (in progress, review, blocked, etc.)',
            'Issue detail with external system links (Jira, GitHub)',
            'Plan view with step-by-step breakdown',
            'Task cards with agent assignments and repo tags',
            '4-stage verification pipeline visualization',
            'Multi-repo project support',
            'Cost tracking and time estimation',
        ],
        'screenshots': {
            'Full Page': 'ops-full.png',
            'Top Bar': 'ops-topbar.png',
            'Issue List': 'ops-issue-list.png',
            'Issue Detail': 'ops-issue-detail.png',
            'Plan Section': 'ops-plan.png',
            'Tasks Section': 'ops-tasks.png',
            'Verification Pipeline': 'ops-verification.png',
        },
    },
    {
        'id': 'kanban',
        'name': 'Kanban',
        'category': 'Workflow Variants',
        'tagline': 'Workflow Board with Issue Lifecycle Columns',
        'layout': 'Six-column kanban board: Backlog \u2192 Planning \u2192 In Progress \u2192 Blocked \u2192 Review \u2192 Done',
        'description': (
            'Kanban provides a visual board where issues flow through six lifecycle columns. Each '
            'card shows the issue title, priority, assigned agent, repo tags, and a compact '
            'verification pipeline status (dots for each stage). Cards can be expanded to reveal '
            'full detail including plan steps, task breakdowns, and PR information. The header '
            'shows aggregate statistics and cost tracking.'
        ),
        'reasoning': (
            'While Ops focuses on detail for a single issue, Kanban provides the big picture '
            'across all issues. The six columns map to the natural issue lifecycle in software '
            'development, making WIP limits and bottlenecks visible at a glance. The compact '
            'verification dots on each card let operators quickly spot which tasks are stuck '
            'in which verification stage without clicking through.'
        ),
        'key_components': [
            'Six lifecycle columns with item counts',
            'Issue cards with priority, agent, and repo tags',
            'Compact verification pipeline dots per card',
            'Expandable card detail with full task/plan info',
            'Blocked column for visibility into impediments',
            'Aggregate stats in header',
        ],
        'screenshots': {
            'Full Page': 'kanban-full.png',
            'Header': 'kanban-header.png',
            'Backlog Column': 'kanban-col-backlog.png',
            'Planning Column': 'kanban-col-planning.png',
            'In Progress Column': 'kanban-col-progress.png',
            'Review Column': 'kanban-col-review.png',
            'Done Column': 'kanban-col-done.png',
            'Issue Card': 'kanban-card.png',
        },
    },
]


# ---------------------------------------------------------------------------
# Comparison data
# ---------------------------------------------------------------------------

COMPARISON_TABLE = [
    ['Variant', 'Layout', 'Focus', 'Best For', 'Data Model'],
    ['AgentOS', 'Sidebar + Tabs', 'Deep work', 'Power users', 'Original'],
    ['Hive', 'Agent columns', 'Agent trust', 'Multi-agent ops', 'Original'],
    ['Pipeline', 'Horizontal stages', 'Quality gates', 'Review workflows', 'Original'],
    ['Nerve Center', 'Dashboard panels', 'Monitoring', 'Fleet oversight', 'Original'],
    ['Mosaic', 'Card grid', 'Overview', 'Team radiator', 'Original'],
    ['Command Center', '5-panel grid', 'Operations', 'Control rooms', 'Original'],
    ['Flow', 'Vertical scroll', 'Narrative', 'Async reviews', 'Original'],
    ['Spatial', '2D canvas', 'Relationships', 'Dependency analysis', 'Original'],
    ['Chat', 'Centered chat', 'Quick start', 'New sessions', 'Original'],
    ['Dashboard', 'Card grid', 'Status recap', 'Returning users', 'Original'],
    ['Command', 'Palette', 'Keyboard', 'Power users', 'Original'],
    ['Brief', 'Dual panel', 'Briefing + chat', 'Decision makers', 'Original'],
    ['Ops', 'List + detail', 'Issue workflow', 'Dev teams', 'Workflow'],
    ['Kanban', '6-col board', 'WIP visibility', 'Project managers', 'Workflow'],
]


ARCHITECTURE_DIMS = [
    {
        'title': 'Information Density',
        'description': 'How much information is visible at once without scrolling.',
        'spectrum': [
            ('Low', ['Flow', 'Chat', 'Command']),
            ('Medium', ['Pipeline', 'Spatial', 'Brief', 'Kanban']),
            ('High', ['AgentOS', 'Hive', 'Nerve Center', 'Mosaic', 'Command Center', 'Ops']),
        ],
    },
    {
        'title': 'Interaction Model',
        'description': 'How users primarily interact with the interface.',
        'spectrum': [
            ('Read-only / Monitor', ['Nerve Center', 'Mosaic', 'Flow', 'Dashboard']),
            ('Select & Inspect', ['Spatial', 'Ops', 'Kanban', 'Brief']),
            ('Direct Manipulation', ['AgentOS', 'Hive', 'Pipeline', 'Command Center', 'Chat', 'Command']),
        ],
    },
    {
        'title': 'Primary Axis',
        'description': 'What the UI is organized around.',
        'spectrum': [
            ('Agent-centric', ['Hive']),
            ('Stage/Workflow', ['Pipeline', 'Kanban']),
            ('Issue/Task', ['Ops', 'AgentOS']),
            ('Strategy/Hierarchy', ['Mosaic', 'Command Center', 'Flow']),
            ('Entity Graph', ['Spatial']),
            ('Action/Command', ['Chat', 'Command', 'Brief']),
            ('Time/Events', ['Nerve Center', 'Dashboard']),
        ],
    },
]


# ---------------------------------------------------------------------------
# Build PDF
# ---------------------------------------------------------------------------

def build_pdf():
    doc = SimpleDocTemplate(
        OUT_PDF,
        pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm,
    )
    story = []

    # ── Cover Page ─────────────────────────────────────────────────
    story.append(Spacer(1, 60*mm))
    story.append(Paragraph('Universal Agent Host', sTitle))
    story.append(Paragraph('UI Variant Showcase & Comparative Analysis', sSubtitle))
    story.append(hr())
    story.append(Paragraph(
        'This document presents every UI variant built for the Universal Agent Host project. '
        'Each variant explores a different information architecture, layout approach, and '
        'interaction model for managing AI agents in software development workflows.',
        sBody,
    ))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        '<b>14 variants</b> across three categories: 8 main operational views, '
        '4 startup/landing pages, and 2 workflow-oriented task managers built on a '
        'new type system designed around real development workflows.',
        sBody,
    ))
    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        '<b>92 screenshot tests</b> verify visual consistency across all variants.',
        sBody,
    ))

    # Navigation bar
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph('Global Navigation Bar', sH3))
    story.append(fit_image(ss('variant-nav.png'), IMG_FULL_W))
    story.append(Paragraph('The shared navigation bar connects all 14 variants, grouped into Main, Startup, and Workflow sections.', sCaption))

    story.append(PageBreak())

    # ── Table of Contents ──────────────────────────────────────────
    story.append(Paragraph('Table of Contents', sH1))
    story.append(Spacer(1, 4*mm))

    current_cat = None
    for i, v in enumerate(VARIANTS):
        if v['category'] != current_cat:
            current_cat = v['category']
            story.append(Spacer(1, 3*mm))
            story.append(Paragraph(f'<b>{current_cat}</b>', ParagraphStyle(
                'TOCCat', fontName='Helvetica-Bold', fontSize=11, textColor=C_ACCENT,
                spaceAfter=2*mm,
            )))
        story.append(Paragraph(
            f'{i+1}. {v["name"]} \u2014 <i>{v["tagline"]}</i>',
            ParagraphStyle('TOCItem', fontName='Helvetica', fontSize=10,
                           textColor=HexColor('#a1a1aa'), leftIndent=8*mm, spaceAfter=1.5*mm),
        ))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph(
        'Appendix A: Comparative Analysis',
        ParagraphStyle('TOCItem', fontName='Helvetica', fontSize=10,
                       textColor=HexColor('#a1a1aa'), spaceAfter=1.5*mm),
    ))
    story.append(Paragraph(
        'Appendix B: Information Architecture Dimensions',
        ParagraphStyle('TOCItem', fontName='Helvetica', fontSize=10,
                       textColor=HexColor('#a1a1aa'), spaceAfter=1.5*mm),
    ))
    story.append(Paragraph(
        'Appendix C: Verification Pipeline Deep Dive',
        ParagraphStyle('TOCItem', fontName='Helvetica', fontSize=10,
                       textColor=HexColor('#a1a1aa'), spaceAfter=1.5*mm),
    ))

    story.append(PageBreak())

    # ── Variant Pages ──────────────────────────────────────────────
    current_cat = None
    for vi, v in enumerate(VARIANTS):
        # Category divider
        if v['category'] != current_cat:
            current_cat = v['category']
            story.append(Spacer(1, 20*mm))
            story.append(Paragraph(current_cat.upper(), ParagraphStyle(
                'CatDivider', fontName='Helvetica-Bold', fontSize=24,
                textColor=C_ACCENT, alignment=TA_CENTER, spaceAfter=4*mm,
            )))
            if current_cat == 'Main Variants':
                story.append(Paragraph(
                    'Eight operational views exploring different information architectures for '
                    'managing AI agents. Each uses the original data model based on abstract '
                    'primitives: Context, Strategy, Execution, and Verification.',
                    ParagraphStyle('CatDesc', fontName='Helvetica', fontSize=10,
                                   textColor=C_MUTED, alignment=TA_CENTER, spaceAfter=8*mm),
                ))
            elif current_cat == 'Startup Variants':
                story.append(Paragraph(
                    'Four landing page variants exploring how users begin new sessions: '
                    'through chat, dashboards, command palettes, or mission briefings.',
                    ParagraphStyle('CatDesc', fontName='Helvetica', fontSize=10,
                                   textColor=C_MUTED, alignment=TA_CENTER, spaceAfter=8*mm),
                ))
            elif current_cat == 'Workflow Variants':
                story.append(Paragraph(
                    'Two task managers built on a new workflow-oriented type system that models '
                    'real development workflows: Projects \u2192 Issues \u2192 Plans \u2192 Tasks \u2192 '
                    '4-stage Verification Pipeline (Prechecks \u2192 AI Review \u2192 PR \u2192 Approval).',
                    ParagraphStyle('CatDesc', fontName='Helvetica', fontSize=10,
                                   textColor=C_MUTED, alignment=TA_CENTER, spaceAfter=8*mm),
                ))
            story.append(PageBreak())

        # --- Variant header ---
        story.append(Paragraph(f'{vi+1}. {v["name"]}', sH1))
        story.append(Paragraph(v['tagline'], ParagraphStyle(
            'Tagline', fontName='Helvetica-Oblique', fontSize=12,
            textColor=C_MUTED, spaceAfter=2*mm,
        )))

        # Layout
        story.append(Paragraph('Layout', sLabel))
        story.append(Paragraph(v['layout'], sBody))

        # Full-page screenshot
        ss_items = list(v['screenshots'].items())
        full_key = ss_items[0]  # First screenshot is always full page
        story.append(Spacer(1, 2*mm))
        story.append(fit_image(ss(full_key[1]), IMG_FULL_W, max_h=280))
        story.append(Paragraph(full_key[0], sCaption))

        # Description
        story.append(Paragraph('Description', sH3))
        story.append(Paragraph(v['description'], sBody))

        # Reasoning
        story.append(Paragraph('Design Reasoning', sH3))
        story.append(Paragraph(v['reasoning'], sBody))

        # Key components
        story.append(Paragraph('Key Components', sH3))
        for comp in v['key_components']:
            story.append(bullet(comp))

        story.append(PageBreak())

        # --- Component screenshots (skip first = full page) ---
        story.append(Paragraph(f'{v["name"]} \u2014 Component Details', sH2))
        story.append(Spacer(1, 2*mm))

        remaining = ss_items[1:]
        # Pair screenshots side by side where possible
        i = 0
        while i < len(remaining):
            if i + 1 < len(remaining):
                # Two side by side
                label1, file1 = remaining[i]
                label2, file2 = remaining[i + 1]
                img1 = fit_image(ss(file1), IMG_HALF_W, max_h=200)
                img2 = fit_image(ss(file2), IMG_HALF_W, max_h=200)
                cap1 = Paragraph(label1, sCaption)
                cap2 = Paragraph(label2, sCaption)

                tbl = Table(
                    [[img1, img2], [cap1, cap2]],
                    colWidths=[IMG_HALF_W + 2*mm, IMG_HALF_W + 2*mm],
                )
                tbl.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 0),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                    ('TOPPADDING', (0, 0), (-1, -1), 0),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 0),
                    ('BOTTOMPADDING', (0, 1), (-1, 1), 3*mm),
                ]))
                story.append(tbl)
                i += 2
            else:
                # Single centered
                label, file = remaining[i]
                story.append(fit_image(ss(file), IMG_COMPONENT_W, max_h=220))
                story.append(Paragraph(label, sCaption))
                i += 1

        story.append(PageBreak())

    # ── Appendix A: Comparison Table ───────────────────────────────
    story.append(Paragraph('Appendix A: Comparative Analysis', sH1))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        'The table below compares all 14 variants across layout type, primary focus, '
        'target user, and underlying data model.',
        sBody,
    ))
    story.append(Spacer(1, 4*mm))

    # Build table
    table_data = []
    for row_i, row in enumerate(COMPARISON_TABLE):
        if row_i == 0:
            table_data.append([Paragraph(c, sTableHeader) for c in row])
        else:
            styled_row = [Paragraph(row[0], sTableCellL)]
            styled_row += [Paragraph(c, sTableCell) for c in row[1:]]
            table_data.append(styled_row)

    col_w = [28*mm, 30*mm, 28*mm, 32*mm, 22*mm]
    tbl = Table(table_data, colWidths=col_w, repeatRows=1)
    tbl.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), C_ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8.5),
        # Alternating rows
        *[('BACKGROUND', (0, i), (-1, i), HexColor('#1a1a2e') if i % 2 == 0 else HexColor('#16162a'))
          for i in range(1, len(table_data))],
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#27272a')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl)

    story.append(PageBreak())

    # ── Appendix B: Architecture Dimensions ────────────────────────
    story.append(Paragraph('Appendix B: Information Architecture Dimensions', sH1))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        'Each variant makes different trade-offs along several architectural dimensions. '
        'Understanding these trade-offs helps choose the right variant for a given context.',
        sBody,
    ))

    for dim in ARCHITECTURE_DIMS:
        story.append(Paragraph(dim['title'], sH2))
        story.append(Paragraph(dim['description'], sBody))
        for level, variants in dim['spectrum']:
            story.append(Paragraph(
                f'<b>{level}:</b> {", ".join(variants)}',
                ParagraphStyle('DimItem', fontName='Helvetica', fontSize=9.5,
                               textColor=HexColor('#a1a1aa'), leftIndent=8*mm,
                               spaceAfter=1.5*mm),
            ))

    story.append(Spacer(1, 8*mm))

    # ── Side-by-side comparisons ──────────────────────────────────
    story.append(Paragraph('Side-by-Side: Ops vs Kanban', sH2))
    story.append(Paragraph(
        'The two workflow variants represent complementary views of the same data. '
        'Ops provides depth for a single issue; Kanban provides breadth across all issues.',
        sBody,
    ))

    img1 = fit_image(ss('ops-full.png'), IMG_HALF_W, max_h=200)
    img2 = fit_image(ss('kanban-full.png'), IMG_HALF_W, max_h=200)
    cap1 = Paragraph('<b>Ops</b> \u2014 Detail-first, single issue focus', sCaption)
    cap2 = Paragraph('<b>Kanban</b> \u2014 Overview-first, all issues at once', sCaption)
    tbl = Table([[img1, img2], [cap1, cap2]],
                colWidths=[IMG_HALF_W + 2*mm, IMG_HALF_W + 2*mm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl)

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph('Side-by-Side: AgentOS vs Command Center', sH2))
    story.append(Paragraph(
        'Both are high-density multi-panel layouts, but AgentOS uses a sidebar hierarchy '
        'while Command Center uses a symmetric grid.',
        sBody,
    ))

    img1 = fit_image(ss('agent-os-taskboard-full.png'), IMG_HALF_W, max_h=200)
    img2 = fit_image(ss('command-center-full.png'), IMG_HALF_W, max_h=200)
    cap1 = Paragraph('<b>AgentOS</b> \u2014 Sidebar + main + console', sCaption)
    cap2 = Paragraph('<b>Command Center</b> \u2014 Symmetric 5-panel grid', sCaption)
    tbl = Table([[img1, img2], [cap1, cap2]],
                colWidths=[IMG_HALF_W + 2*mm, IMG_HALF_W + 2*mm])
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl)

    story.append(PageBreak())

    story.append(Paragraph('Side-by-Side: Startup Variants', sH2))
    story.append(Paragraph(
        'Four different approaches to the initial user experience, each optimized for a '
        'different interaction style.',
        sBody,
    ))

    img1 = fit_image(ss('startup-chat-full.png'), IMG_HALF_W, max_h=180)
    img2 = fit_image(ss('startup-dashboard-full.png'), IMG_HALF_W, max_h=180)
    cap1 = Paragraph('<b>Chat</b> \u2014 Conversation-first', sCaption)
    cap2 = Paragraph('<b>Dashboard</b> \u2014 Status overview', sCaption)
    tbl1 = Table([[img1, img2], [cap1, cap2]],
                 colWidths=[IMG_HALF_W + 2*mm, IMG_HALF_W + 2*mm])
    tbl1.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl1)

    story.append(Spacer(1, 4*mm))

    img3 = fit_image(ss('startup-command-full.png'), IMG_HALF_W, max_h=180)
    img4 = fit_image(ss('startup-brief-full.png'), IMG_HALF_W, max_h=180)
    cap3 = Paragraph('<b>Command</b> \u2014 Keyboard-driven', sCaption)
    cap4 = Paragraph('<b>Brief</b> \u2014 Briefing + chat dual-panel', sCaption)
    tbl2 = Table([[img3, img4], [cap3, cap4]],
                 colWidths=[IMG_HALF_W + 2*mm, IMG_HALF_W + 2*mm])
    tbl2.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl2)

    story.append(PageBreak())

    # All full-page screenshots in a grid for overview
    story.append(Paragraph('All Variants at a Glance', sH2))
    story.append(Paragraph(
        'Thumbnail overview of every variant\'s full-page screenshot, showing the range of '
        'layout approaches explored.',
        sBody,
    ))

    thumb_w = (CONTENT_W - 6*mm) / 3
    all_fulls = [
        ('AgentOS', 'agent-os-taskboard-full.png'),
        ('Hive', 'hive-full.png'),
        ('Pipeline', 'pipeline-full.png'),
        ('Nerve Center', 'nerve-center-full.png'),
        ('Mosaic', 'mosaic-full.png'),
        ('Command Center', 'command-center-full.png'),
        ('Flow', 'flow-full.png'),
        ('Spatial', 'spatial-full.png'),
        ('Chat', 'startup-chat-full.png'),
        ('Dashboard', 'startup-dashboard-full.png'),
        ('Command', 'startup-command-full.png'),
        ('Brief', 'startup-brief-full.png'),
        ('Ops', 'ops-full.png'),
        ('Kanban', 'kanban-full.png'),
    ]

    thumb_rows = []
    for i in range(0, len(all_fulls), 3):
        chunk = all_fulls[i:i+3]
        img_row = []
        cap_row = []
        for name, fname in chunk:
            img_row.append(fit_image(ss(fname), thumb_w - 2*mm, max_h=110))
            cap_row.append(Paragraph(f'<b>{name}</b>', sCaption))
        # Pad if last row is incomplete
        while len(img_row) < 3:
            img_row.append(Paragraph('', sCaption))
            cap_row.append(Paragraph('', sCaption))
        thumb_rows.append(img_row)
        thumb_rows.append(cap_row)

    tbl = Table(thumb_rows, colWidths=[thumb_w + 1*mm] * 3)
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('LEFTPADDING', (0, 0), (-1, -1), 1*mm),
        ('RIGHTPADDING', (0, 0), (-1, -1), 1*mm),
        ('TOPPADDING', (0, 0), (-1, -1), 1*mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(tbl)

    story.append(PageBreak())

    # ── Appendix C: Verification Pipeline ──────────────────────────
    story.append(Paragraph('Appendix C: Verification Pipeline Deep Dive', sH1))
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        'The workflow variants (Ops and Kanban) introduce a 4-stage verification pipeline '
        'that models how code changes are validated in real development workflows.',
        sBody,
    ))

    story.append(Paragraph('The 4 Stages', sH2))

    stages_data = [
        ['Stage', 'Type', 'Description', 'Gate Criteria'],
        ['1. Prechecks', 'Automatic',
         'Lint, types, tests, and build bundled as one gate',
         'All checks pass, tests green, build succeeds'],
        ['2. AI Review', 'Automatic',
         'An AI agent reviews the diff for correctness and architecture',
         'No critical findings, severity \u2264 minor'],
        ['3. PR', 'Automatic',
         'Branch pushed, pull request created on the target repo',
         'PR created and CI passes'],
        ['4. Approval', 'Manual',
         'Human reviews the PR and approves or requests changes',
         'Required approvals met, no changes requested'],
    ]

    stage_tbl = Table(
        [[Paragraph(c, sTableHeader if ri == 0 else sTableCell) for c in row]
         for ri, row in enumerate(stages_data)],
        colWidths=[24*mm, 22*mm, 52*mm, 42*mm],
        repeatRows=1,
    )
    stage_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), C_ACCENT),
        ('TEXTCOLOR', (0, 0), (-1, 0), C_WHITE),
        *[('BACKGROUND', (0, i), (-1, i), HexColor('#1a1a2e') if i % 2 == 0 else HexColor('#16162a'))
          for i in range(1, len(stages_data))],
        ('GRID', (0, 0), (-1, -1), 0.5, HexColor('#27272a')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(stage_tbl)

    story.append(Spacer(1, 6*mm))

    story.append(Paragraph('Why 4 Stages?', sH2))
    story.append(Paragraph(
        'Earlier iterations had 7 granular stages (lint, typecheck, test, build, security scan, '
        'PR create, PR review, manual approval). This was refined down to 4 meaningful gates:',
        sBody,
    ))
    story.append(bullet(
        '<b>Prechecks</b> bundles all automated quality checks. Individually, lint/types/tests/build '
        'are implementation details \u2014 what matters is "does the code meet quality standards?"'
    ))
    story.append(bullet(
        '<b>AI Review</b> is the novel addition: an AI agent reviews the diff for correctness, '
        'architecture concerns, and potential issues. This catches problems before human reviewers see them.'
    ))
    story.append(bullet(
        '<b>PR</b> makes the transition from "code on a branch" to "code visible to the team" explicit. '
        'This is where the work becomes social and visible.'
    ))
    story.append(bullet(
        '<b>Approval</b> is the final human gate. After prechecks pass, AI reviews it, and a PR is '
        'created, a human makes the final judgment. This keeps humans in the loop for the decisions that matter.'
    ))

    story.append(Spacer(1, 6*mm))

    # Show verification pipeline screenshots
    story.append(Paragraph('Verification Pipeline in Ops', sH2))
    story.append(fit_image(ss('ops-verification.png'), IMG_COMPONENT_W, max_h=200))
    story.append(Paragraph('The 4-stage pipeline visualization in the Ops variant, showing stage status and metadata.', sCaption))

    story.append(Spacer(1, 6*mm))

    story.append(Paragraph('Data Model Evolution', sH2))
    story.append(Paragraph(
        'The project uses two data models in parallel. The <b>original model</b> '
        '(primitives.ts) uses abstract concepts: Context, Strategy, Execution, Verification. '
        'The <b>workflow model</b> (workflow.ts) uses concrete dev concepts: Project, Issue, '
        'Plan, Task, VerificationPipeline. The workflow model was designed to "bridge the gap '
        'to a real dev workflow" by using terminology and structures that map directly to how '
        'development teams actually think about their work.',
        sBody,
    ))

    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(
        '<b>Original Model</b> (8 main + 4 startup variants):<br/>'
        'Context \u2192 Strategy \u2192 Execution \u2192 Verification',
        ParagraphStyle('ModelDesc', fontName='Helvetica', fontSize=9.5,
                       textColor=HexColor('#a1a1aa'), leftIndent=8*mm, spaceAfter=3*mm,
                       leading=14),
    ))
    story.append(Paragraph(
        '<b>Workflow Model</b> (Ops + Kanban):<br/>'
        'Project \u2192 Issue (Jira/DevOps) \u2192 Plan \u2192 Task \u2192 '
        'VerificationPipeline (4 stages)',
        ParagraphStyle('ModelDesc', fontName='Helvetica', fontSize=9.5,
                       textColor=HexColor('#a1a1aa'), leftIndent=8*mm, spaceAfter=3*mm,
                       leading=14),
    ))

    # ── Build ──────────────────────────────────────────────────────
    doc.build(story)
    print(f'PDF generated: {OUT_PDF}')
    print(f'Size: {os.path.getsize(OUT_PDF) / 1024:.0f} KB')


if __name__ == '__main__':
    build_pdf()
