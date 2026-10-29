const groups = {
  "ci:server": "general-server-without-chat",
  "ci:chat": "general-chat",
  "ci:workspaces-a": "general-workspaces-a",
  "ci:workspaces-b": "general-workspaces-b",
  "ci:db": "general-workspaces-c",
};

export function executionPlan(config, task, args) {
  const definition = config.tasks[`//#${task}`];
  if (!definition?.cache) throw new Error(`Task is not executable through the cache: ${task}`);
  let target, commandArgs;
  if (groups[task]) {
    target = "//#test:run:general";
    commandArgs = ["--", "--group", groups[task], ...args];
  } else if (task === "ci:serialized") {
    target = "//#test:run:serialized";
    commandArgs = ["--", ...args];
  } else if (task === "ci:runner-rust") {
    target = "@paperclipai/paperclip-runner#check:runner";
    commandArgs = args;
  } else throw new Error(`Missing task command: ${task}`);
  const inputs = target.startsWith("//#") ? definition.inputs
    : definition.inputs.map((input) => `$TURBO_ROOT$/${input}`);
  return { target, args: commandArgs, config: { ...config, tasks: { [target]: { ...definition, inputs } } } };
}
