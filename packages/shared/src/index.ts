// Schemas
export {
  agentEventSchema,
  agentSessionStartSchema,
  agentSessionEndSchema,
  agentTextDeltaSchema,
  agentThinkingSchema,
  agentToolCallSchema,
  agentToolResultSchema,
  agentErrorSchema,
  agentCostUpdateSchema,
  agentSubagentStartSchema,
  agentSubagentEndSchema,
  // ARO events
  aroExecutionPlanEventSchema,
  aroSecurityVerdictEventSchema,
  aroHumanApprovalRequestSchema,
  aroHumanApprovalResponseSchema,
  aroRoiFrameEventSchema,
  aroHostAlertEventSchema,
} from './schemas/events.js';

export {
  adapterManifestSchema,
  sessionConfigSchema,
  sessionStatusSchema,
  sessionInfoSchema,
  sessionSummarySchema,
  startSessionBodySchema,
} from './schemas/sessions.js';

export {
  issueSchema,
  issuePrioritySchema,
  issueStatusSchema,
  taskSchema,
  taskStatusSchema,
  planSchema,
  planStepSchema,
  verificationStageSchema,
  verificationResultSchema,
  verificationStepSchema,
  verificationPipelineSchema,
} from './schemas/workflow.js';

export {
  claudeStreamMessageSchema,
  claudeSystemMessageSchema,
  claudeAssistantMessageSchema,
  claudeUserMessageSchema,
  claudeResultMessageSchema,
  claudeContentBlockSchema,
  claudeTextBlockSchema,
  claudeThinkingBlockSchema,
  claudeToolUseBlockSchema,
  claudeToolResultBlockSchema,
} from './schemas/claude-cli.js';

export {
  wsCommandSchema,
  wsSubscribeAllSchema,
  wsSubscribeSessionSchema,
  wsUnsubscribeAllSchema,
  wsUnsubscribeSessionSchema,
  wsSubscribedSchema,
  wsUnsubscribedSchema,
  wsErrorSchema,
  // ARO WS commands
  wsSubscribeHostSchema,
  wsApproveStepSchema,
  wsRequestRoiSchema,
} from './schemas/ws.js';

// Types
export type {
  AgentEvent,
  AgentSessionStart,
  AgentSessionEnd,
  AgentTextDelta,
  AgentThinking,
  AgentToolCall,
  AgentToolResult,
  AgentError,
  AgentCostUpdate,
  AgentSubagentStart,
  AgentSubagentEnd,
  // ARO event types
  AroExecutionPlanEvent,
  AroSecurityVerdictEvent,
  AroHumanApprovalRequest,
  AroHumanApprovalResponse,
  AroRoiFrameEvent,
  AroHostAlertEvent,
} from './schemas/events.js';

export type {
  AdapterManifest,
  SessionConfig,
  SessionStatus,
  SessionInfo,
  SessionSummary,
  StartSessionBody,
} from './schemas/sessions.js';

export type {
  Issue,
  IssuePriority,
  IssueStatus,
  Task,
  TaskStatus,
  Plan,
  PlanStep,
  VerificationStage,
  VerificationResult,
  VerificationStep,
  VerificationPipeline,
} from './schemas/workflow.js';

export type {
  ClaudeStreamMessage,
  ClaudeSystemMessage,
  ClaudeAssistantMessage,
  ClaudeUserMessage,
  ClaudeResultMessage,
  ClaudeContentBlock,
} from './schemas/claude-cli.js';

export type {
  WsCommand,
  WsSubscribeAll,
  WsSubscribeSession,
  WsUnsubscribeAll,
  WsUnsubscribeSession,
  WsSubscribed,
  WsUnsubscribed,
  WsError,
  // ARO WS types
  WsSubscribeHost,
  WsApproveStep,
  WsRequestRoi,
} from './schemas/ws.js';

// ARO schemas
export {
  aroRiskLevelSchema,
  aroSecurityActionSchema,
  aroSecurityRuleSchema,
  aroSecurityPolicySchema,
  aroSecurityVerdictSchema,
  aroHostStatusSchema,
  aroHostOsSchema,
  aroHostConnectionSchema,
  aroBoundingBoxSchema,
  aroRoiFormatSchema,
  aroRoiFrameSchema,
  aroPlanStepTypeSchema,
  aroPlanStepSchema,
  aroExecutionPlanSchema,
  aroMonitorTypeSchema,
  aroMonitorConfigSchema,
  aroAlertSeveritySchema,
  aroAlertSchema,
  aroSessionExtraSchema,
} from './schemas/aro.js';

export type {
  AroRiskLevel,
  AroSecurityAction,
  AroSecurityRule,
  AroSecurityPolicy,
  AroSecurityVerdict,
  AroHostStatus,
  AroHostOs,
  AroHostConnection,
  AroBoundingBox,
  AroRoiFormat,
  AroRoiFrame,
  AroPlanStepType,
  AroPlanStep,
  AroExecutionPlan,
  AroMonitorType,
  AroMonitorConfig,
  AroAlertSeverity,
  AroAlert,
  AroSessionExtra,
} from './schemas/aro.js';

// Contracts
export * from './contracts/index.js';
