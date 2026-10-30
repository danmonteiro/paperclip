export function turboArgs({ target, runtimeConfig, cacheDir, force, dryRun, args }) {
  return ["run", target, "--root-turbo-json", runtimeConfig, "--summarize",
    ...(force ? ["--cache=local:r"] : ["--cache=local:rw"]), `--cache-dir=${cacheDir}`,
    ...(dryRun ? ["--dry=json"] : []), ...(force ? ["--force"] : []), "--", ...args];
}
