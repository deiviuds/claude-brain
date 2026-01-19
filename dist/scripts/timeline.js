#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'fs';

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

// src/scripts/timeline.ts
async function loadSDK() {
  return await import('@memvid/sdk');
}
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0] || "10", 10);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const memoryPath = resolve(projectDir, ".claude/mind.mv2");
  const { use, create } = await loadSDK();
  const { memvid, isNew } = await openMemorySafely(memoryPath, use, create);
  if (isNew || !memvid) {
    console.log("\u2705 Memory initialized! No memories to show yet.\n");
    process.exit(0);
  }
  try {
    const mv = memvid;
    const timeline = await mv.timeline({ limit, reverse: true });
    const frames = Array.isArray(timeline) ? timeline : timeline.frames || [];
    if (frames.length === 0) {
      console.log("No memories yet. Start using Claude to build your memory!");
      process.exit(0);
    }
    console.log(`Recent ${frames.length} memories:
`);
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const preview = frame.preview || "";
      const uri = frame.uri || `frame/${frame.frame_id}`;
      const timestamp = frame.timestamp ? new Date(frame.timestamp * 1e3).toLocaleString() : "Unknown time";
      const snippet = preview.slice(0, 100).replace(/\n/g, " ");
      console.log(`#${i + 1} ${uri}`);
      console.log(`   \u{1F4C5} ${timestamp}`);
      console.log(`   ${snippet}${snippet.length >= 100 ? "..." : ""}`);
      console.log();
    }
  } catch (error) {
    console.error("Error reading timeline:", error);
    process.exit(1);
  }
}
main();
//# sourceMappingURL=timeline.js.map
//# sourceMappingURL=timeline.js.map