import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { promisify } from "node:util";

import { makeReleaseNotes } from "./release-notes.mjs";

const execFileAsync = promisify(execFile);
const temporaryDirectories = [];

after(async () => {
  await Promise.all(
    temporaryDirectories.map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("ZDE public release notes", () => {
  it("preserves the verified release description", () => {
    assert.equal(
      makeReleaseNotes({
        version: "0.2.2",
        channel: "stable",
        sourceSha: "0123456789abcdef0123456789abcdef01234567",
      }),
      "ZDE 0.2.2 (stable, Apple Silicon macOS)\n\n" +
        "Built from Epoch-ML/zerg commit 0123456789abcdef0123456789abcdef01234567 " +
        "after source, dependency, Apple platform-signature, updater-signature, " +
        "and artifact verification.\n",
    );
  });

  it("writes one new notes file and refuses to overwrite it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "zde-release-notes-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "notes.md");
    const arguments_ = [
      new URL("./release-notes.mjs", import.meta.url).pathname,
      outputPath,
      "0.2.2-preview.1",
      "preview",
      "fedcba9876543210fedcba9876543210fedcba98",
    ];

    await execFileAsync(process.execPath, arguments_);
    assert.equal(
      await readFile(outputPath, "utf8"),
      "ZDE 0.2.2-preview.1 (preview, Apple Silicon macOS)\n\n" +
        "Built from Epoch-ML/zerg commit fedcba9876543210fedcba9876543210fedcba98 " +
        "after source, dependency, Apple platform-signature, updater-signature, " +
        "and artifact verification.\n",
    );
    await assert.rejects(
      execFileAsync(process.execPath, arguments_),
      (error) => error.code === 1 && /EEXIST/u.test(error.stderr),
    );
  });
});
