import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it, vi } from "vitest";
import { NativeEnvironmentProbeCleanupError, probeNativeRunnerEnvironment } from "./runnerd-codex-transport.js";

it("retains a timed-out probe home until the actual owned child exits, then runs cleanup exactly once", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-probe-retained-"));
  const home = join(root, "selected-home");
  await mkdir(home, { mode: 0o700 });
  let started!: () => void;
  const launched = new Promise<void>(resolve => { started = resolve; });
  let child: ReturnType<typeof spawn> | undefined;
  let exited!: Promise<void>;
  const cleanup = vi.fn(async () => {
    expect(child!.exitCode !== null || child!.signalCode !== null).toBe(true);
    await rm(home, { recursive: true, force: true });
  });
  const probe = probeNativeRunnerEnvironment({ runtimeDirectory: root, provider: "codex", model: "fixture-model", admissionOnly: true,
    environment: {}, timeoutMs: 1000, onCleanupConfirmed: cleanup,
    transportOptions: { sourceCodexHome: "", runnerBinary: resolve("runner/target/debug/paperclip-runnerd"), codexCommand: resolve("runner/target/debug/fake-codex-app-server"),
      runnerProcessLauncher: () => {
        child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore", env: { PATH: "/usr/bin:/bin" } });
        exited = new Promise<void>(resolve => child!.once("exit", () => resolve()));
        started();
        return {
          // A controlled process owner reports an unresolved signal dispatch.
          // The real child remains alive until this test's original owner stops it.
          child: { pid: child.pid, exitCode: null, signalCode: null, kill: () => true },
          processGroupId: null,
          isExitConfirmed: () => child!.exitCode !== null || child!.signalCode !== null,
          completion: exited.then(() => ({ code: child!.exitCode, signal: child!.signalCode, stdout: "", stderr: "" })),
        };
      },
    },
  }).catch(error => error);
  try {
    await launched;
    const failure = await probe;
    expect(failure).toBeInstanceOf(NativeEnvironmentProbeCleanupError);
    expect(failure.operationError).toBeInstanceOf(Error);
    expect(failure.cleanupErrors.length).toBeGreaterThan(0);
    let retired = false;
    void failure.retired.then(() => { retired = true; });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(retired).toBe(false);
    expect(cleanup).not.toHaveBeenCalled();
    expect((await stat(home)).isDirectory()).toBe(true);
    expect(child!.exitCode).toBeNull();
    child!.kill("SIGKILL");
    await exited;
    await failure.retired;
    expect(retired).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
    await expect(stat(home)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    child?.kill("SIGKILL");
    await exited;
    await probe;
    await rm(root, { recursive: true, force: true });
  }
}, 40_000);
