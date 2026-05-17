import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import type {
  AIExecutionCallbacks,
  AIProviderAdapter,
  AIProviderConfig,
  AIProviderResolvedCommand,
  AIRunHandle,
  AIRunRequest,
} from './types';

function splitArgs(template: string): string[] {
  const parts = template.match(/(?:[^"]\S*|".+?")+/g) ?? [];
  return parts.map((part) => part.replace(/^"|"$/g, ''));
}

function interpolate(template: string, request: AIRunRequest): string {
  return template
    .replace(/\{\{prompt\}\}/g, request.prompt)
    .replace(/\{\{context\}\}/g, request.contextText)
    .replace(/\{\{cwd\}\}/g, request.workingDirectory);
}

function createAdapter(_provider: AIProviderConfig): AIProviderAdapter {
  return {
    buildRequest(request: AIRunRequest): AIProviderResolvedCommand {
      const interpolated = interpolate(request.provider.argsTemplate, request);
      return {
        command: request.provider.executablePath,
        args: splitArgs(interpolated),
        cwd: request.workingDirectory,
      };
    },
  };
}

export function getAIProviderAdapter(provider: AIProviderConfig): AIProviderAdapter {
  return createAdapter(provider);
}

export function runAIProviderCommand(
  request: AIRunRequest,
  callbacks: AIExecutionCallbacks,
): AIRunHandle {
  const adapter = getAIProviderAdapter(request.provider);
  const resolved = adapter.buildRequest(request);
  const child: ChildProcessWithoutNullStreams = spawn(resolved.command, resolved.args, {
    cwd: resolved.cwd,
    env: process.env,
  });

  child.stdout.on('data', (chunk) => {
    callbacks.onStdout?.(String(chunk));
  });

  child.stderr.on('data', (chunk) => {
    callbacks.onStderr?.(String(chunk));
  });

  child.on('error', (error) => {
    callbacks.onError?.(error);
  });

  child.on('exit', (code) => {
    callbacks.onExit?.(code);
  });

  return {
    commandSummary: [resolved.command, ...resolved.args].join(' '),
    stop: () => {
      child.kill();
    },
  };
}
