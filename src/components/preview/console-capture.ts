// Console Capture — intercepts console logs from the WebContainer preview iframe.
//
// Strategy:
//   1. Inject a tiny script into the WebContainer's index.html that overrides
//      console.log/warn/error/info and posts messages to window.parent.
//   2. The preview-panel listens for these messages and stores them in memory.
//   3. Errors are surfaced to the workspace for the auto-debug loop.
//
// The injected script has ZERO dependencies — it's a plain string template
// that runs in the WebContainer's iframe context.

import type { ConsoleLogEntry, BuildError, ConsoleLogLevel } from "@/types";

// ─────────────────────────────────────────────
// Console capture script (injected into WebContainer index.html)
// ─────────────────────────────────────────────

/** Minimal script injected into the WebContainer to intercept console calls. */
export const CONSOLE_CAPTURE_SCRIPT = `
<script data-fyren-console-capture>
(function() {
  var LEVELS = ['log', 'info', 'warn', 'error'];
  var _original = {};
  LEVELS.forEach(function(level) {
    _original[level] = console[level];
    console[level] = function() {
      // Call original so logs still appear in the iframe's devtools
      _original[level].apply(console, arguments);

      // Serialize args to strings
      var parts = [];
      for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        if (arg instanceof Error) {
          parts.push(arg.message + (arg.stack ? '\\n' + arg.stack : ''));
        } else if (typeof arg === 'object') {
          try { parts.push(JSON.stringify(arg, null, 2)); }
          catch(e) { parts.push(String(arg)); }
        } else {
          parts.push(String(arg));
        }
      }

      var message = parts.join(' ');
      var stack = undefined;

      // Extract stack trace for errors
      if (level === 'error') {
        try {
          var err = new Error();
          stack = err.stack ? err.stack.split('\\n').slice(2).join('\\n') : undefined;
        } catch(e) {}
        // If the first arg was an Error, use its stack
        if (arguments[0] instanceof Error && arguments[0].stack) {
          stack = arguments[0].stack;
        }
      }

      try {
        window.parent.postMessage({
          type: '__FYREN_CONSOLE__',
          level: level,
          message: message,
          stack: stack,
          timestamp: new Date().toISOString()
        }, '*');
      } catch(e) {}
    };
  });

  // Also capture unhandled errors
  window.addEventListener('error', function(event) {
    var source = event.filename ? (event.filename + ':' + event.lineno + ':' + event.colno) : undefined;
    try {
      window.parent.postMessage({
        type: '__FYREN_CONSOLE__',
        level: 'error',
        message: event.message || 'Unhandled error',
        stack: event.error ? event.error.stack : undefined,
        source: source,
        timestamp: new Date().toISOString()
      }, '*');
    } catch(e) {}
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    var message = 'Unhandled promise rejection';
    var stack = undefined;
    if (event.reason) {
      message = event.reason.message || String(event.reason);
      stack = event.reason.stack;
    }
    try {
      window.parent.postMessage({
        type: '__FYREN_CONSOLE__',
        level: 'error',
        message: message,
        stack: stack,
        timestamp: new Date().toISOString()
      }, '*');
    } catch(e) {}
  });
})();
</script>`;

// ─────────────────────────────────────────────
// Message type guard
// ─────────────────────────────────────────────

interface FyrenConsoleMessage {
  type: "__FYREN_CONSOLE__";
  level: ConsoleLogLevel;
  message: string;
  stack?: string;
  source?: string;
  timestamp: string;
}

export function isFyrenConsoleMessage(data: unknown): data is FyrenConsoleMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as Record<string, unknown>).type === "__FYREN_CONSOLE__"
  );
}

export function toConsoleLogEntry(msg: FyrenConsoleMessage): ConsoleLogEntry {
  return {
    id: `console-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    level: msg.level,
    message: msg.message,
    stack: msg.stack,
    source: msg.source,
    timestamp: msg.timestamp,
  };
}

// ─────────────────────────────────────────────
// Vite/TypeScript build error parser
// ─────────────────────────────────────────────

// Matches Vite error output like:
//   [plugin:vite:react-babel] /workspace/src/App.tsx: Unexpected token (5:3)
//   ERROR(TypeScript)  src/App.tsx(5,3): error TS1005: ';' expected.
//   src/App.tsx:5:3 - error TS1005: ';' expected.
const VITE_ERROR_RE =
  /(?:ERROR\(.*?\)\s+)?([^\s(]+\.(?:tsx?|jsx?|css|json))[:(](\d+)[,:]?(\d+)?[)]?.*?(?:error\s+\w+:\s*)?(.+)/;

const VITE_PLUGIN_ERROR_RE =
  /\[plugin:[^\]]+\]\s+.*?([^\s(]+\.(?:tsx?|jsx?|css|json))[:(]\s*(\d+)[,:]?\s*(\d+)?\)?.*$/;

export function parseBuildError(stderr: string): BuildError[] {
  const errors: BuildError[] = [];
  const lines = stderr.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(VITE_ERROR_RE) ?? trimmed.match(VITE_PLUGIN_ERROR_RE);
    if (match) {
      errors.push({
        id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: match[1]!.replace(/^\/workspace\//, ""),
        line: match[2] ? parseInt(match[2], 10) : undefined,
        column: match[3] ? parseInt(match[3], 10) : undefined,
        message: match[4]?.trim() ?? trimmed,
        severity: trimmed.toLowerCase().includes("warning") ? "warning" : "error",
        timestamp: new Date().toISOString(),
      });
      continue;
    }

    // Catch generic "error" lines from Vite
    if (/error/i.test(trimmed) && !trimmed.startsWith("at ") && trimmed.length > 5) {
      errors.push({
        id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file: "unknown",
        message: trimmed,
        severity: "error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  return errors;
}

// ─────────────────────────────────────────────
// Max log buffer size (in-memory only, no DB)
// ─────────────────────────────────────────────

export const MAX_CONSOLE_LOGS = 500;
export const MAX_BUILD_ERRORS = 100;
