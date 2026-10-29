import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const turbo = process.env.PAPERCLIP_CI_TEST_TURBO ?? new URL("../../node_modules/.bin/turbo", import.meta.url).pathname;

test("real Turbo restores outputs and invalidates source, environment, toolchain and failed tasks", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "ci-turbo-"));
  const write = (name, content) => writeFileSync(path.join(directory, name), content);
  const json = (name, value) => write(name, JSON.stringify(value));
  try {
    execFileSync("git", ["init", "-q"], { cwd: directory });
    write(".gitignore", ".turbo/\ngenerated/\nresult.txt\ncalls.txt\n");
    mkdirSync(path.join(directory, "packages/fixture"), { recursive: true });
    json("packages/fixture/package.json", { name: "fixture", private: true });
    json("package.json", { name: "cache-proof", private: true, packageManager: "npm@10.0.0", workspaces: ["packages/*"],
      scripts: { prepare: "node prepare.cjs", check: "node check.cjs" } });
    json("package-lock.json", { name: "cache-proof", lockfileVersion: 3, packages: { "": { name: "cache-proof" } } });
    json("turbo.json", { globalEnv: ["CI_TASK_CACHE_SCOPE"], tasks: {
      "//#prepare": { inputs: ["input.txt", "prepare.cjs"], outputs: ["generated/**"] },
      "//#check": { dependsOn: ["//#prepare"], inputs: ["check.cjs"], outputs: ["result.txt"], env: ["FLAVOR"] },
    } });
    write("input.txt", "first");
    write("prepare.cjs", `const fs = require('node:fs'); fs.mkdirSync('generated', {recursive:true}); fs.copyFileSync('input.txt','generated/input.txt');`);
    write("check.cjs", `const fs = require('node:fs'); fs.appendFileSync('calls.txt','call\\n'); const input=fs.readFileSync('generated/input.txt','utf8'); if(input==='fail') process.exit(1); fs.writeFileSync('result.txt',input+process.env.FLAVOR);`);
    const run = (extra = {}) => spawnSync(turbo, ["run", "check", "--cache=local:rw", "--cache-dir=.turbo/cache"], {
      cwd: directory, encoding: "utf8", env: { ...process.env, TURBO_TELEMETRY_DISABLED: "1", FLAVOR: "a", CI_TASK_CACHE_SCOPE: "node-24", ...extra },
    });
    const calls = () => readFileSync(path.join(directory, "calls.txt"), "utf8").trim().split("\n").length;
    const pass = (extra) => { const r = run(extra); assert.equal(r.status, 0, r.stdout + r.stderr); return r; };
    pass(); assert.equal(calls(), 1);
    rmSync(path.join(directory, "generated"), { recursive: true });
    rmSync(path.join(directory, "result.txt"));
    pass(); assert.equal(calls(), 1, "cached task must not execute");
    assert.equal(readFileSync(path.join(directory, "result.txt"), "utf8"), "firsta");
    assert.equal(readFileSync(path.join(directory, "generated/input.txt"), "utf8"), "first");
    write("unrelated.md", "another push");
    pass(); assert.equal(calls(), 1, "unrelated input must retain the result");
    write("input.txt", "second");
    pass(); assert.equal(calls(), 2, "dependency source must invalidate downstream checks");
    pass({ FLAVOR: "b" }); assert.equal(calls(), 3);
    pass({ FLAVOR: "b", CI_TASK_CACHE_SCOPE: "node-25" }); assert.equal(calls(), 4);
    write("input.txt", "fail");
    assert.notEqual(run().status, 0); assert.notEqual(run().status, 0);
    assert.equal(calls(), 6, "a failed task must execute on every attempt");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
