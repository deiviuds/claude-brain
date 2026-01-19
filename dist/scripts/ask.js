#!/usr/bin/env node
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

async function createFreshMemory(memoryPath, create) {
  const memoryDir = dirname(memoryPath);
  mkdirSync(memoryDir, { recursive: true });
  await create(memoryPath, "basic");
}
function isCorruptedMemoryError(error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return errorMessage.includes("Deserialization") || errorMessage.includes("UnexpectedVariant") || errorMessage.includes("Invalid") || errorMessage.includes("corrupt") || errorMessage.includes("version mismatch") || errorMessage.includes("validation failed") || errorMessage.includes("unable to recover") || errorMessage.includes("table of contents");
}
async function handleCorruptedMemory(memoryPath, create) {
  console.log(
    "\u26A0\uFE0F  Memory file is corrupted or incompatible. Creating fresh memory..."
  );
  const backupPath = `${memoryPath}.backup-${Date.now()}`;
  try {
    renameSync(memoryPath, backupPath);
    console.log(`   Old file backed up to: ${backupPath}`);
  } catch {
    try {
      unlinkSync(memoryPath);
    } catch {
    }
  }
  await createFreshMemory(memoryPath, create);
}
async function openMemorySafely(memoryPath, use, create) {
  if (!existsSync(memoryPath)) {
    console.log("No memory file found. Creating new memory at:", memoryPath);
    await createFreshMemory(memoryPath, create);
    return { memvid: null, isNew: true };
  }
  try {
    const memvid = await use("basic", memoryPath);
    return { memvid, isNew: false };
  } catch (openError) {
    if (isCorruptedMemoryError(openError)) {
      await handleCorruptedMemory(memoryPath, create);
      return { memvid: null, isNew: true };
    }
    throw openError;
  }
}

// src/scripts/ask.ts
async function ensureDeps() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = resolve(__dirname, "../..");
  const sdkPath = resolve(pluginRoot, "node_modules/@memvid/sdk");
  if (!existsSync(sdkPath)) {
    console.log("Installing dependencies...");
    try {
      execSync("npm install --production --no-fund --no-audit", {
        cwd: pluginRoot,
        stdio: "inherit",
        timeout: 12e4
      });
    } catch {
      console.error("Failed to install dependencies. Please run: npm install");
      process.exit(1);
    }
  }
}
async function loadSDK() {
  await ensureDeps();
  return await import('@memvid/sdk');
}
async function main() {
  const args = process.argv.slice(2);
  const question = args.join(" ");
  if (!question) {
    console.error("Usage: ask.js <question>");
    process.exit(1);
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const memoryPath = resolve(projectDir, ".claude/mind.mv2");
  const { use, create } = await loadSDK();
  const { memvid, isNew } = await openMemorySafely(memoryPath, use, create);
  if (isNew || !memvid) {
    console.log("\u2705 Memory initialized! No memories to ask about yet.\n");
    process.exit(0);
  }
  try {
    const mv = memvid;
    const result = await mv.ask(question, { k: 5, mode: "lex" });
    if (result.answer) {
      console.log("Answer:", result.answer);
    } else {
      const searchResults = await mv.find(question, { k: 5, mode: "lex" });
      if (!searchResults.hits || searchResults.hits.length === 0) {
        console.log("No relevant memories found for your question.");
        process.exit(0);
      }
      console.log("Relevant memories:\n");
      for (const hit of searchResults.hits) {
        const title = hit.title || "Untitled";
        const snippet = (hit.snippet || "").slice(0, 300).replace(/\n/g, " ");
        console.log(`\u2022 ${title}`);
        console.log(`  ${snippet}${snippet.length >= 300 ? "..." : ""}
`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}
main();
//# sourceMappingURL=ask.js.map
//# sourceMappingURL=ask.js.map