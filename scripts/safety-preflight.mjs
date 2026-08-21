import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const EXPECTED_PACKAGE = "into-the-politicalverse";
const EXPECTED_BRANCH = "agent/foundation";
const EXPECTED_REMOTE = "https://github.com/willrydh/Into-The-Politicalverse";
const DEV_HOST = "127.0.0.1";
const DEV_PORT = 4317;
const PROTECTED_PORTS = new Set([3000, 3001, 3100, 8000, 8790]);

function fail(message) {
  console.error(`Politicalverse safety check failed: ${message}`);
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function normalizeRemote(remote) {
  return remote
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
}

function filesIn(directory, extensions) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => join(directory, entry.name));
}

function assertPortIsNotRouted() {
  const routeFiles = [
    ...filesIn(join(homedir(), ".cloudflared"), [".yml", ".yaml"]),
    ...filesIn(join(homedir(), "Library", "LaunchAgents"), [".plist"]),
  ];
  const target = new RegExp(`(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0):${DEV_PORT}\\b`);

  for (const file of routeFiles) {
    if (target.test(readFileSync(file, "utf8"))) {
      fail(`development port ${DEV_PORT} is referenced by a tunnel or service definition`);
    }
  }
}

function assertPortIsFree() {
  return new Promise((resolveCheck, rejectCheck) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => rejectCheck(error));
    server.listen({ host: DEV_HOST, port: DEV_PORT, exclusive: true }, () => {
      server.close(() => resolveCheck());
    });
  });
}

const projectRoot = realpathSync(resolve(process.cwd()));
const packageJson = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

if (packageJson.name !== EXPECTED_PACKAGE) fail(`unexpected package ${packageJson.name ?? "<missing>"}`);

let gitRoot;
let branch;
let remote;

try {
  gitRoot = realpathSync(git("rev-parse", "--show-toplevel"));
  branch = git("branch", "--show-current");
  remote = normalizeRemote(git("config", "--get", "remote.origin.url"));
} catch {
  fail("Git identity could not be verified");
}

if (gitRoot !== projectRoot) fail("command is not running from the repository root");
if (branch !== EXPECTED_BRANCH) fail(`expected branch ${EXPECTED_BRANCH}, found ${branch || "detached HEAD"}`);
if (remote !== EXPECTED_REMOTE) fail(`unexpected Git remote ${remote}`);
if (PROTECTED_PORTS.has(DEV_PORT)) fail(`development port ${DEV_PORT} is reserved`);
if (process.env.PORT && Number(process.env.PORT) !== DEV_PORT) fail(`PORT must remain ${DEV_PORT}`);

assertPortIsNotRouted();

try {
  await assertPortIsFree();
} catch (error) {
  fail(`development port ${DEV_PORT} is unavailable (${error.code ?? "unknown error"})`);
}

console.log(`Politicalverse safety check passed: ${EXPECTED_BRANCH} on ${DEV_HOST}:${DEV_PORT}`);
