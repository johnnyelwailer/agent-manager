import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  onMessage: (message: unknown) => void;
  onStderr?: (line: string) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
}

export interface ManagedProcess {
  id: string;
  child: ChildProcess;
  pid: number | undefined;
  interrupt(): void;
  terminate(): void;
  kill(): void;
  write(data: string): void;
}

export class ProcessManager {
  private processes = new Map<string, ManagedProcess>();

  spawn(options: SpawnOptions): ManagedProcess {
    const id = randomUUID();
    const { command, args, cwd, env, onMessage, onStderr, onExit } = options;

    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.stdout) {
      const rl = createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed: unknown = JSON.parse(trimmed);
          onMessage(parsed);
        } catch {
          onStderr?.(trimmed);
        }
      });
    }

    if (child.stderr) {
      const rl = createInterface({ input: child.stderr });
      rl.on('line', (line) => {
        onStderr?.(line);
      });
    }

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

  get(id: string): ManagedProcess | undefined {
    return this.processes.get(id);
  }

  list(): string[] {
    return Array.from(this.processes.keys());
  }

  get count(): number {
    return this.processes.size;
  }

  terminateAll(): void {
    for (const proc of this.processes.values()) {
      proc.terminate();
    }
  }

  killAll(): void {
    for (const proc of this.processes.values()) {
      proc.kill();
    }
    this.processes.clear();
  }
}
