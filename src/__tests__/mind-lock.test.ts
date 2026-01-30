import { describe, it, expect } from "vitest";
import { Mind } from "../core/mind.js";
import { mkdtempSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempMemoryPath(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "claude-brain-lock-"));
  // Create .claude subdirectory
  const claudeDir = join(dir, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  return { dir, path: join(claudeDir, "mind.mv2") };
}

async function writeOnce(memoryPath: string, i: number): Promise<void> {
  const mind = await Mind.open({ memoryPath, debug: false });
  await mind.remember({
    type: "discovery",
    summary: `summary-${i}`,
    content: `content-${i}`,
  });
}

describe("Mind concurrent access", () => {
  it("writes all frames in the happy path (single writer)", async () => {
    const { dir, path } = makeTempMemoryPath();
    try {
      const writes = 5;
      for (let i = 0; i < writes; i++) {
        await writeOnce(path, i);
      }

      const mind = await Mind.open({ memoryPath: path, debug: false });
      const stats = await mind.stats();
      expect(stats.totalObservations).toBe(writes);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves all frames with concurrent writers (edge case)", async () => {
    const { dir, path } = makeTempMemoryPath();
    try {
      const writes = 20;
      const tasks = Array.from({ length: writes }, (_, i) => writeOnce(path, i));
      const results = await Promise.allSettled(tasks);

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) {
        throw failed[0].reason;
      }

      const mind = await Mind.open({ memoryPath: path, debug: false });
      const stats = await mind.stats();
      expect(stats.totalObservations).toBe(writes);

      const claudeDir = join(dir, ".claude");
      const backups = readdirSync(claudeDir).filter((f) => f.includes(".backup-"));
      expect(backups.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15000);

  it("distinguishes observations by source tool", async () => {
    const { dir, path } = makeTempMemoryPath();
    try {
      // Simulate Claude Code observation
      const mind1 = await Mind.open({ memoryPath: path, debug: false });
      await mind1.remember({
        type: "discovery",
        summary: "Read file.ts",
        content: "file contents from claude-code",
        metadata: { source: "claude-code", sessionId: "cc-session-1" },
      });

      // Simulate OpenCode observation (same file)
      const mind2 = await Mind.open({ memoryPath: path, debug: false });
      await mind2.remember({
        type: "discovery",
        summary: "Read file.ts",
        content: "file contents from opencode",
        metadata: { source: "opencode", sessionId: "oc-session-1" },
      });

      const mind = await Mind.open({ memoryPath: path, debug: false });
      const stats = await mind.stats();

      // Both should be stored (different sources)
      expect(stats.totalObservations).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts sessionId from metadata and stores it", async () => {
    const { dir, path } = makeTempMemoryPath();
    try {
      const sessionId = "test-session-123";

      // Write with explicit sessionId in metadata
      const mind = await Mind.open({ memoryPath: path, debug: false });
      await mind.remember({
        type: "discovery",
        summary: "test with custom session",
        content: "content with session id",
        metadata: { sessionId },
      });

      // Verify observation was stored
      const stats = await mind.stats();
      expect(stats.totalObservations).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
