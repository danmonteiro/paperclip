import { afterEach, expect, it, vi } from "vitest";
import { configuredEnvironmentProjection } from "../../configured-environment.js";
import { createSanitizedAcpxSpawnInput } from "./environment.js";

afterEach(() => vi.unstubAllEnvs());

it("keeps the selected key while removing conflicting explicitly projected Google auth and runtime controls", () => {
  const source = configuredEnvironmentProjection({
    GEMINI_API_KEY: "selected-key", GOOGLE_API_KEY: "other-key", GOOGLE_APPLICATION_CREDENTIALS: "/foreign/adc.json",
    GOOGLE_GENAI_USE_VERTEXAI: "true", GOOGLE_CLOUD_PROJECT: "foreign-project", GEMINI_HOME: "/foreign/home",
    AGY_LLM_GATEWAY_URL: "https://foreign.invalid", ANTIGRAVITY_HARNESS_PATH: "/foreign/helper",
    CLOUDSDK_CONFIG: "/foreign/cloud", AGY_ACP_FORCE_FILE_STORAGE: "0", TASK_INPUT: "retained",
  });
  const env = createSanitizedAcpxSpawnInput(source, "antigravity").env;
  expect(env.GEMINI_API_KEY).toBe("selected-key");
  expect(env.TASK_INPUT).toBe("retained");
  for (const name of Object.keys(source)) {
    if (/^(?:GOOGLE_|GEMINI_|AGY_|ANTIGRAVITY_|CLOUDSDK_)/.test(name) && name !== "GEMINI_API_KEY") expect(env[name]).toBeUndefined();
  }
  expect(JSON.parse(env.PAPERCLIP_CONFIGURED_ENV_KEYS!)).toEqual(["GEMINI_API_KEY", "TASK_INPUT"]);
});

it("does not borrow an ambient Gemini key", () => {
  vi.stubEnv("GEMINI_API_KEY", "ambient-key");
  expect(createSanitizedAcpxSpawnInput(undefined, "antigravity").env.GEMINI_API_KEY).toBeUndefined();
});
