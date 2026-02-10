import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
} from '@assistant-ui/react';
import { SendHorizontal, ArrowDown, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentMessage } from './agent-message';
import { Button } from '@/components/ui/button';

/**
 * Complete chat thread composed from assistant-ui primitives.
 * Renders the message list, auto-scroll viewport, and input composer.
 */
export function AgentThread({ className }: { className?: string }) {
  return (
    <ThreadPrimitive.Root className={cn('flex h-full flex-col', className)}>
      <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
        <ThreadPrimitive.Empty>
          <ThreadEmpty />
        </ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            AssistantMessage: AgentMessage,
            SystemMessage: SystemMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <ThreadScrollToBottom />

      <Composer />
    </ThreadPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function ThreadEmpty() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">No messages yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Start a session or select one to view
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User message
// ---------------------------------------------------------------------------

function UserMessage() {
  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        <MessagePrimitive.Content />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System message
// ---------------------------------------------------------------------------

function SystemMessage() {
  return (
    <div className="px-4 py-1.5">
      <div className="text-xs text-muted-foreground">
        <MessagePrimitive.Content />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll to bottom button
// ---------------------------------------------------------------------------

function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button
        variant="outline"
        size="icon-sm"
        className="absolute bottom-28 right-4 z-10 rounded-full shadow-md"
      >
        <ArrowDown className="size-4" />
      </Button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

function Composer() {
  return (
    <ComposerPrimitive.Root className="border-t border-border bg-background px-4 py-3">
      <div className="flex items-end gap-2">
        <ComposerPrimitive.Input
          autoFocus
          placeholder="Send a message..."
          className="min-h-[40px] max-h-[200px] flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={1}
        />
        <ThreadPrimitive.If running>
          <ComposerPrimitive.Cancel asChild>
            <Button variant="destructive" size="icon">
              <Square className="size-4" />
            </Button>
          </ComposerPrimitive.Cancel>
        </ThreadPrimitive.If>
        <ThreadPrimitive.If running={false}>
          <ComposerPrimitive.Send asChild>
            <Button size="icon">
              <SendHorizontal className="size-4" />
            </Button>
          </ComposerPrimitive.Send>
        </ThreadPrimitive.If>
      </div>
    </ComposerPrimitive.Root>
  );
}
