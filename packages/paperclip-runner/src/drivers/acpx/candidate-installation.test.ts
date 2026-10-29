import { afterEach, describe, expect, it, vi } from "vitest";
import { bindAcpxCandidateAdmission } from "./candidate-admission.js";
import { ANTIGRAVITY_DISTRIBUTION_PINS } from "./generated-profiles.js";
import { resolveQualifiedAcpxProfile } from "./qualified-profiles.js";
import { verifyAcpxProfileInstallation } from "./profile-installation.js";
import { AcpxRuntimeHost } from "./runtime-host.js";
import * as integrity from "./installation-integrity.js";

vi.mock("./installation-integrity.js", async importOriginal => ({
  ...await importOriginal<typeof import("./installation-integrity.js")>(),
  verifyNativeAcpxInstallation: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
const profile = resolveQualifiedAcpxProfile("antigravity", "gemini-3.8-flash-low");
const admission = () => bindAcpxCandidateAdmission({ schema: "paperclip.acpx-candidate-admission.v1", companyId: "company-candidate", agent: "antigravity", model: profile.qualificationModel,
  profileDigest: profile.commandDigest, nativeClosureDigest: `sha256:${ANTIGRAVITY_DISTRIBUTION_PINS["darwin-arm64"].closureSha256}`,
  platform: "darwin", architecture: "arm64", expiresAt: Date.now() + 60_000 }, { runId: "run-candidate", normalizedSessionId: "session-candidate" });

describe("candidate installation remains cryptographically verified", () => {
  it.skipIf(process.platform !== "darwin" || process.arch !== "arm64")("delegates the admitted exception to the exact complete native closure verifier", async () => {
    const native = { commandDigest: "native-closure-verifier-result" } as integrity.VerifiedAcpxInstallation;
    vi.mocked(integrity.verifyNativeAcpxInstallation).mockResolvedValue(native);
    const result = await verifyAcpxProfileInstallation(profile, admission());
    expect(result.commandDigest).toBe(profile.commandDigest);
    expect(integrity.verifyNativeAcpxInstallation).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      expectedClosureSha256: ANTIGRAVITY_DISTRIBUTION_PINS["darwin-arm64"].closureSha256,
      executable: "agy_acp_server.par", fixedArguments: [],
    }));
  });

  it("denies absent, altered, or other-provider authority before any native files are opened", async () => {
    vi.mocked(integrity.verifyNativeAcpxInstallation).mockClear();
    await expect(verifyAcpxProfileInstallation(profile)).rejects.toMatchObject({ code: "ACPX_PROFILE_QUALIFICATION_PENDING" });
    await expect(verifyAcpxProfileInstallation(profile, { ...admission(), model: "gemini-3.8-flash-high" })).rejects.toMatchObject({ code: "ACPX_CANDIDATE_ADMISSION_INVALID" });
    await expect(verifyAcpxProfileInstallation(resolveQualifiedAcpxProfile("codex", profile.qualificationModel), admission())).rejects.toMatchObject({ code: "ACPX_CANDIDATE_ADMISSION_INVALID" });
    expect(integrity.verifyNativeAcpxInstallation).not.toHaveBeenCalled();
  });

  it("rejects a candidate session mismatch before installation, credentials, or runtime acquisition", async () => {
    const verifyInstallation = vi.fn(), openRuntime = vi.fn();
    await expect(AcpxRuntimeHost.open({ candidateAdmission: admission(), runtimeDirectory: "/unused", normalizedSessionId: "another-session", workingDirectory: "/unused", agent: "antigravity", model: profile.qualificationModel,
      permissionMode: "deny-all", providerPolicy: { readOnly: true } }, { verifyInstallation, openRuntime, retainAdmissionCleanup: () => {}, reportRetainedCleanupFailure: () => {} })).rejects.toMatchObject({ code: "ACPX_CANDIDATE_ADMISSION_INVALID" });
    expect(verifyInstallation).not.toHaveBeenCalled();
    expect(openRuntime).not.toHaveBeenCalled();
  });
});
