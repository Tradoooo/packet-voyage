/**
 * Shared CLI plumbing: documented exit codes (§5.8), the I/O abstraction,
 * the config home (`~/.packet-voyage`, overridable via `PACKET_VOYAGE_HOME`
 * for tests), and the `CliError` carrier.
 *
 * No workspace-package import here: this module must load — and `--help`
 * must print — even while a sibling package is still being written.
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import type { VoyageDeps } from './deps.ts';

/** Documented exit codes (CONTRACTS §5.8). */
export const EXIT_OK = 0;
export const EXIT_BAD_ARG = 2;
export const EXIT_NO_TOOL = 3;
export const EXIT_REFUSED = 4;
export const EXIT_UNREADABLE = 5;
/** Undocumented fallback for internal/environment failures. */
export const EXIT_INTERNAL = 1;

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  readStdin: () => Promise<string>;
  isStdinTty: () => boolean;
  confirm: (question: string) => Promise<boolean>;
  env: NodeJS.ProcessEnv;
  cwd: string;
  platform: NodeJS.Platform;
  now: () => string;
}

/** Everything a command handler receives; tests build it with fakes. */
export interface CliContext {
  io: CliIo;
  home: string;
  deps: VoyageDeps;
}

/** Error carrying one of the documented §5.8 exit codes. */
export class CliError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message: string) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export function defaultHomeDir(env: NodeJS.ProcessEnv): string {
  const override = env.PACKET_VOYAGE_HOME?.trim();
  return override && override !== '' ? resolve(override) : join(homedir(), '.packet-voyage');
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function promptConfirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^y(?:es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

/** The production I/O, bound to this process. */
export function defaultIo(): CliIo {
  return {
    stdout: (text) => {
      process.stdout.write(text);
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    readStdin: readAllStdin,
    isStdinTty: () => Boolean(process.stdin.isTTY),
    confirm: promptConfirm,
    env: process.env,
    cwd: process.cwd(),
    platform: process.platform,
    now: () => new Date().toISOString(),
  };
}
