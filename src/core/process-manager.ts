// Spawns and manages child processes. Reads NDJSON from stdout, emits parsed
// lines via a callback. Handles process lifecycle (spawn, signal, cleanup).

import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  /** The command to run (e.g. "claude") */
  command: string;
  /** Arguments (e.g. ["-p", "fix the bug", "--output-format", "stream-json"]) */
  args: string[];
  /** Working directory */
  cwd: string;
  /** Extra environment variables (merged with process.env) */
  env?: Record<string, string>;
  /** Called for each parsed JSON line from stdout */
  onMessage: (message: unknown) => void;
  /** Called when stderr produces a line */
  onStderr?: (line: string) => void;
  /** Called when the process exits */
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface ManagedProcess {
  /** Unique ID for this process instance */
  id: string;
  /** The underlying child process */
  child: ChildProcess;
  /** PID if available */
  pid: number | undefined;
  /** Send SIGINT (graceful interrupt) */
  interrupt(): void;
  /** Send SIGTERM (terminate) */
  terminate(): void;
  /** Send SIGKILL (force kill) */
  kill(): void;
  /** Write to stdin (for interactive sessions) */
  write(data: string): void;
}

// ---------------------------------------------------------------------------
// ProcessManager
// ---------------------------------------------------------------------------

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();

  /** Spawn a child process and stream NDJSON from its stdout */
  spawn(options: SpawnOptions): ManagedProcess {
    const id = randomUUID();
    const { command, args, cwd, env, onMessage, onStderr, onExit } = options;

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse stdout as NDJSON (one JSON object per line)
    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed);
          onMessage(parsed);
        } catch {
          // Not valid JSON — could be a non-JSON line from the process.
          // Forward to stderr handler as a fallback.
          onStderr?.(trimmed);
        }
      });
    }

    // Capture stderr
    if (child.stderr) {
      const rl = createInterface({ input: child.stderr });
      rl.on('line', (line) => {
        onStderr?.(line);
      });
    }

    // Handle exit
    child.on('exit', (code, signal) => {
      this.processes.delete(id);
      onExit(code, signal);
    });

    child.on('error', (err) => {
      this.processes.delete(id);
      onExit(null, null);
      onStderr?.(`Process error: ${err.message}`);
    });

    const managed: ManagedProcess = {
      id,
      child,
      pid: child.pid,
      interrupt() {
        child.kill('SIGINT');
      },
      terminate() {
        child.kill('SIGTERM');
      },
      kill() {
        child.kill('SIGKILL');
      },
      write(data: string) {
        child.stdin?.write(data);
      },
    };

    this.processes.set(id, managed);
    return managed;
  }

  /** Get a managed process by ID */
  get(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  /** List all running process IDs */
  list(): string[] {
    return Array.from(this.processes.keys());
  }

  /** Number of active processes */
  get count(): number {
    return this.processes.size;
  }

  /** Terminate all managed processes */
  terminateAll(): void {
    for (const proc of this.processes.values()) {
      proc.terminate();
    }
  }

  /** Kill all managed processes (force) */
  killAll(): void {
    for (const proc of this.processes.values()) {
      proc.kill();
    }
    this.processes.clear();
  }
}
