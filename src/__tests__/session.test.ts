import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  writeSessionInfo,
  readSessionInfo,
  getSessionId,
  detectSource,
} from "../utils/session.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Session Management", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), "claude-brain-session-"));
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  describe("detectSource", () => {
    it("detects opencode from OPENCODE_SESSION_ID", () => {
      vi.stubEnv("OPENCODE_SESSION_ID", "test-session");
      expect(detectSource()).toBe("opencode");
    });

    it("detects opencode from OPENCODE_DIR", () => {
      vi.stubEnv("OPENCODE_DIR", "/test/dir");
      expect(detectSource()).toBe("opencode");
    });

    it("detects claude-code from CLAUDE_PROJECT_DIR", () => {
      vi.stubEnv("CLAUDE_PROJECT_DIR", "/test/project");
      expect(detectSource()).toBe("claude-code");
    });

    it("prioritizes opencode over claude-code", () => {
      vi.stubEnv("OPENCODE_SESSION_ID", "test-session");
      vi.stubEnv("CLAUDE_PROJECT_DIR", "/test/project");
      expect(detectSource()).toBe("opencode");
    });

    it("defaults to claude-code when no env vars set", () => {
      // Clear any existing env vars
      delete process.env.OPENCODE_SESSION_ID;
      delete process.env.OPENCODE_DIR;
      delete process.env.CLAUDE_PROJECT_DIR;
      expect(detectSource()).toBe("claude-code");
    });
  });

  describe("writeSessionInfo / readSessionInfo", () => {
    it("writes and reads session info correctly", async () => {
      const sessionId = "test-session-123";
      const source = "claude-code" as const;

      await writeSessionInfo(testDir, sessionId, source);
      const info = await readSessionInfo(testDir, source);

      expect(info).not.toBeNull();
      expect(info?.sessionId).toBe(sessionId);
      expect(info?.source).toBe(source);
      expect(info?.startTime).toBeTypeOf("number");
    });

    it("returns null for non-existent session", async () => {
      const info = await readSessionInfo(testDir, "claude-code");
      expect(info).toBeNull();
    });

    it("keeps sessions separate by source", async () => {
      await writeSessionInfo(testDir, "claude-session", "claude-code");
      await writeSessionInfo(testDir, "opencode-session", "opencode");

      const claudeInfo = await readSessionInfo(testDir, "claude-code");
      const opencodeInfo = await readSessionInfo(testDir, "opencode");

      expect(claudeInfo?.sessionId).toBe("claude-session");
      expect(opencodeInfo?.sessionId).toBe("opencode-session");
    });

    it("overwrites existing session info", async () => {
      await writeSessionInfo(testDir, "first-session", "claude-code");
      await writeSessionInfo(testDir, "second-session", "claude-code");

      const info = await readSessionInfo(testDir, "claude-code");
      expect(info?.sessionId).toBe("second-session");
    });
  });

  describe("getSessionId", () => {
    it("returns existing session ID if available", async () => {
      vi.stubEnv("CLAUDE_PROJECT_DIR", testDir);
      await writeSessionInfo(testDir, "existing-session", "claude-code");

      const sessionId = await getSessionId(testDir);
      expect(sessionId).toBe("existing-session");
    });

    it("returns fallback ID if no session exists", async () => {
      vi.stubEnv("CLAUDE_PROJECT_DIR", testDir);
      const fallbackId = "fallback-123";

      const sessionId = await getSessionId(testDir, fallbackId);
      expect(sessionId).toBe(fallbackId);
    });

    it("generates new ID if no session and no fallback", async () => {
      vi.stubEnv("CLAUDE_PROJECT_DIR", testDir);

      const sessionId = await getSessionId(testDir);
      expect(sessionId).toMatch(/^claude-code-\d+-[a-z0-9]+$/);
    });

    it("uses correct source for session lookup", async () => {
      vi.stubEnv("OPENCODE_SESSION_ID", "test");
      await writeSessionInfo(testDir, "opencode-session", "opencode");

      const sessionId = await getSessionId(testDir);
      expect(sessionId).toBe("opencode-session");
    });
  });
});
