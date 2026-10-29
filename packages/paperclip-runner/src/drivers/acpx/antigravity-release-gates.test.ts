import { describe, expect, it, vi } from "vitest";
import { CodexAcpxDriver } from "./codex-acpx-driver.js";
import { acpxCapabilities, acpxDriverDescriptor, validateAcpxDriverConfig } from "./driver-profile.js";
import { verifyQualifiedAcpxInstallation } from "./installation-integrity.js";
import { verifyAcpxProfileInstallation } from "./profile-installation.js";
import { assertAcpxProfileReleased, resolveQualifiedAcpxProfile } from "./qualified-profiles.js";

describe("Antigravity pending release boundaries", () => {
  it("retains release admission for existing providers, including Copilot's separate capability status", () => {
    for (const agent of ["claude", "codex", "grok", "cursor", "pi", "copilot"] as const) {
      expect(() => assertAcpxProfileReleased(agent)).not.toThrow();
    }
    expect(acpxCapabilities("copilot")).toMatchObject({ typedEvents: true, dynamicTools: true });
  });

  it("preserves the caller's exact model separately from release admission", () => {
    expect(resolveQualifiedAcpxProfile("antigravity", "caller-exact-model")).toMatchObject({
      agent: "antigravity", qualificationStatus: "pending", qualificationModel: "caller-exact-model", reportedModelId: "caller-exact-model",
    });
    expect(validateAcpxDriverConfig({ agent: "antigravity", model: "caller-exact-model" }))
      .toMatchObject({ ok: false, issues: [{ path: "agent", code: "qualification_pending" }] });
    expect(() => assertAcpxProfileReleased("antigravity")).toThrow(expect.objectContaining({ code: "ACPX_PROFILE_QUALIFICATION_PENDING" }));
  });

  it("advertises no accepted runtime or context capabilities", () => {
    expect(acpxDriverDescriptor("antigravity")).toMatchObject({ displayName: "Google Antigravity via ACPX",
      runtimeContextCapabilities: { instructions: "unsupported", skills: "unsupported", mcp: "unsupported" } });
    for (const value of Object.values(acpxCapabilities("antigravity"))) {
      if (typeof value === "boolean") expect(value).toBe(false);
    }
  });

  it("rejects direct construction before opening a runtime host", () => {
    const openHost = vi.fn();
    expect(() => new CodexAcpxDriver({ agent: "antigravity", model: "caller-exact-model", runtimeDirectory: "/unused",
      providerPolicy: { readOnly: false } }, { openHost }))
      .toThrow(expect.objectContaining({ code: "ACPX_PROFILE_QUALIFICATION_PENDING" }));
    expect(openHost).not.toHaveBeenCalled();
  });

  it("refuses raw installation lookup even after a caller strips the pending marker", async () => {
    const profile = { ...resolveQualifiedAcpxProfile("antigravity", "caller-exact-model"), qualificationStatus: undefined };
    const resolvePackage = vi.fn();
    await expect(verifyQualifiedAcpxInstallation(profile, resolvePackage))
      .rejects.toMatchObject({ code: "ACPX_PROFILE_QUALIFICATION_PENDING" });
    await expect(verifyAcpxProfileInstallation(profile))
      .rejects.toMatchObject({ code: "ACPX_PROFILE_QUALIFICATION_PENDING" });
    expect(resolvePackage).not.toHaveBeenCalled();
  });
});
