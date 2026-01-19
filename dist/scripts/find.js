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

// src/scripts/find.ts
async function loadSDK() {
  return await import('@memvid/sdk');
}
async function main() {
  const args = process.argv.slice(2);
  const query = args[0];
  const limit = parseInt(args[1] || "5", 10);
  if (!query) {
    console.error("Usage: find.js <query> [limit]");
    process.exit(1);
  }
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const memoryPath = resolve(projectDir, ".claude/mind.mv2");
  const { use, create } = await loadSDK();
  const { memvid, isNew } = await openMemorySafely(memoryPath, use, create);
  if (isNew || !memvid) {
    console.log("\u2705 Memory initialized! No memories to search yet.\n");
    process.exit(0);
  }
  try {
    const results = await memvid.find(query, { k: limit, mode: "lex" });
    const hits = results.hits || [];
    if (hits.length === 0) {
      console.log(`No memories found for: "${query}"`);
      process.exit(0);
    }
    console.log(`Found ${results.total_hits || hits.length} memories for: "${query}"
`);
    for (const hit of hits) {
      const title = hit.title || "Untitled";
      const score = hit.score?.toFixed(2) || "N/A";
      const snippet = (hit.snippet || "").slice(0, 200).replace(/\n/g, " ");
      const labels = hit.labels?.slice(0, 3).join(", ") || "";
      console.log(`[${labels || "memory"}] ${title}`);
      console.log(`  Score: ${score} | URI: ${hit.uri || ""}`);
      console.log(`  ${snippet}${snippet.length >= 200 ? "..." : ""}`);
      console.log();
    }
  } catch (error) {
    console.error("Error searching memories:", error);
    process.exit(1);
  }
}
main();
//# sourceMappingURL=find.js.map
//# sourceMappingURL=find.js.map