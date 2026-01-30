#!/usr/bin/env node
import 'crypto';
import { mkdir, open, writeFile } from 'fs/promises';
import { basename, resolve, dirname } from 'path';
import lockfile from 'proper-lockfile';
import { existsSync, statSync } from 'fs';

async function readStdin() {
  const chunks = [];
  return new Promise((resolve2, reject) => {
    process.stdin.on("data", (chunk) => chunks.push(chunk));
    process.stdin.on("end", () => resolve2(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
  });
}
function writeOutput(output) {
  console.log(JSON.stringify(output));
  process.exit(0);
}
function debug(message) {
  if (process.env.MEMVID_MIND_DEBUG === "1") {
    console.error(`[memvid-mind] ${message}`);
  }
}
var LOCK_OPTIONS = {
  stale: 3e4,
  retries: {
    retries: 1e3,
    minTimeout: 5,
    maxTimeout: 50
  }
};
async function withMemvidLock(lockPath, fn) {
  await mkdir(dirname(lockPath), { recursive: true });
  const handle = await open(lockPath, "a");
  await handle.close();
  const release = await lockfile.lock(lockPath, LOCK_OPTIONS);
  try {
    return await fn();
  } finally {
    await release();
  }
}

// src/utils/session.ts
function getSessionPath(directory, source) {
  return `${directory}/.claude/mind-session-${source}.json`;
}
function detectSource() {
  if (process.env.OPENCODE_SESSION_ID) return "opencode";
  if (process.env.OPENCODE_DIR) return "opencode";
  if (process.env.CLAUDE_PROJECT_DIR && !process.env.OPENCODE_SESSION_ID) return "claude-code";
  return "claude-code";
}
async function writeSessionInfo(directory, sessionId, source) {
  const sessionPath = getSessionPath(directory, source);
  const lockPath = `${sessionPath}.lock`;
  await mkdir(dirname(sessionPath), { recursive: true });
  await withMemvidLock(lockPath, async () => {
    const info = {
      sessionId,
      source,
      startTime: Date.now()
    };
    await writeFile(sessionPath, JSON.stringify(info));
  });
}
async function main() {
  try {
    const input = await readStdin();
    const hookInput = JSON.parse(input);
    debug(`Session starting: ${hookInput.session_id}`);
    const projectDir = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const source = detectSource();
    try {
      await writeSessionInfo(projectDir, hookInput.session_id, source);
      debug(`Session info written: ${hookInput.session_id} (${source})`);
    } catch (err) {
      debug(`Failed to write session info: ${err}`);
    }
    const projectName = basename(projectDir);
    const memoryPath = resolve(projectDir, ".claude/mind.mv2");
    const memoryExists = existsSync(memoryPath);
    const contextLines = [];
    if (memoryExists) {
      try {
        const stats = statSync(memoryPath);
        const fileSizeKB = Math.round(stats.size / 1024);
        contextLines.push("<memvid-mind-context>");
        contextLines.push("# \u{1F9E0} Claude Mind Active");
        contextLines.push("");
        contextLines.push(`\u{1F4C1} Project: **${projectName}**`);
        contextLines.push(`\u{1F4BE} Memory: \`.claude/mind.mv2\` (${fileSizeKB} KB)`);
        contextLines.push("");
        contextLines.push("**Commands:**");
        contextLines.push("- `/mind:search <query>` - Search memories");
        contextLines.push("- `/mind:ask <question>` - Ask your memory");
        contextLines.push("- `/mind:recent` - View timeline");
        contextLines.push("- `/mind:stats` - View statistics");
        contextLines.push("");
        contextLines.push("_Memories are captured automatically from your tool use._");
        contextLines.push("</memvid-mind-context>");
      } catch {
      }
    } else {
      contextLines.push("<memvid-mind-context>");
      contextLines.push("# \u{1F9E0} Claude Mind Ready");
      contextLines.push("");
      contextLines.push(`\u{1F4C1} Project: **${projectName}**`);
      contextLines.push("\u{1F4BE} Memory will be created at: `.claude/mind.mv2`");
      contextLines.push("");
      contextLines.push("_Your observations will be automatically captured._");
      contextLines.push("</memvid-mind-context>");
    }
    const output = {
      continue: true
    };
    if (contextLines.length > 0) {
      output.hookSpecificOutput = {
        hookEventName: "SessionStart",
        additionalContext: contextLines.join("\n")
      };
    }
    writeOutput(output);
  } catch (error) {
    debug(`Error: ${error}`);
    writeOutput({ continue: true });
  }
}
main();
//# sourceMappingURL=session-start.js.map
//# sourceMappingURL=session-start.js.map