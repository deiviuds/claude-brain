#!/usr/bin/env node
import 'crypto';
import { existsSync, statSync } from 'fs';
import { basename, resolve } from 'path';

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
async function main() {
  try {
    const input = await readStdin();
    const hookInput = JSON.parse(input);
    debug(`Session starting: ${hookInput.session_id}`);
    const projectDir = hookInput.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
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