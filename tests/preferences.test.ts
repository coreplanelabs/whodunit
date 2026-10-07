import { expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchCli } from "../src/cli-api.js";
import { readPreferences, writePreferences } from "../src/preferences.js";

function profile(run: (home: string) => void) {
  const home = mkdtempSync(join(tmpdir(), "whodunit-settings-"));
  try {
    run(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}
test("missing settings mean ask first and do not create files", () =>
  profile((home) => {
    expect(readPreferences(home).autoFix).toBe(false);
    expect(existsSync(join(home, ".coreplanelabs"))).toBe(false);
  }));
test("auto-fix survives a new reader and can be turned off", () =>
  profile((home) => {
    const saved = writePreferences(true, home);
    expect(readPreferences(home).autoFix).toBe(true);
    expect(JSON.parse(readFileSync(saved.path, "utf8"))).toEqual({
      schemaVersion: "whodunit-settings/1",
      autoFix: true,
    });
    if (process.platform !== "win32")
      expect(statSync(saved.path).mode & 0o777).toBe(0o600);
    writePreferences(false, home);
    expect(readPreferences(home).autoFix).toBe(false);
  }));
test("invalid or aliased settings are preserved, not treated as authorization", () =>
  profile((home) => {
    const saved = writePreferences(false, home);
    writeFileSync(saved.path, '{"autoFix":"yes","privateNote":"keep me"}');
    expect(() => readPreferences(home)).toThrow();
    expect(() => writePreferences(true, home)).toThrow();
    expect(readFileSync(saved.path, "utf8")).toContain("privateNote");
    rmSync(saved.path);
    const external = join(home, "outside.json");
    writeFileSync(external, "private bytes");
    symlinkSync(external, saved.path);
    expect(() => readPreferences(home)).toThrow();
    expect(() => writePreferences(true, home)).toThrow();
    expect(readFileSync(external, "utf8")).toBe("private bytes");
    rmSync(saved.path);
    symlinkSync(join(home, "missing.json"), saved.path);
    expect(() => writePreferences(true, home)).toThrow();
  }));
test("a symlinked settings folder cannot redirect writes", () =>
  profile((home) => {
    const outside = join(home, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(home, ".coreplanelabs"), "dir");
    expect(() => writePreferences(true, home)).toThrow();
    expect(existsSync(join(outside, "whodunit"))).toBe(false);
  }));
test("settings CLI persists a user choice without touching report contents", async () => {
  const home = mkdtempSync(join(tmpdir(), "whodunit-settings-cli-"));
  try {
    let output = "",
      errors = "",
      writes = 0;
    const io = {
      read: () => {
        throw Error("No evidence read");
      },
      out: (s: string) => (output += s),
      error: (s: string) => (errors += s),
      preferences: {
        read: readPreferences,
        write: (enabled: boolean, root?: string) => {
          writes++;
          return writePreferences(enabled, root);
        },
      },
    };
    expect(
      await dispatchCli(["settings", "auto-fix", "on", "--home", home], io),
    ).toBe(0);
    expect(readPreferences(home).autoFix).toBe(true);
    output = "";
    expect(await dispatchCli(["settings", "show", "--home", home], io)).toBe(0);
    expect(JSON.parse(output).autoFix).toBe(true);
    expect(
      await dispatchCli(["settings", "auto-fix", "maybe", "--home", home], io),
    ).toBe(1);
    expect(writes).toBe(1);
    expect(errors).not.toContain("private");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
