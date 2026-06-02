import { execSync } from "node:child_process";

const autoRefreshMessages = [
  "Update sky cam snapshot",
  "Update sky cam snapshot [skip deploy]"
];

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function getCommitMessage() {
  return process.env.VERCEL_GIT_COMMIT_MESSAGE || run("git log -1 --pretty=%B");
}

function getChangedFiles() {
  try {
    const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
    const current = process.env.VERCEL_GIT_COMMIT_SHA || "HEAD";
    const diffRange = previous ? `${previous}..${current}` : "HEAD~1..HEAD";
    return run(`git diff --name-only ${diffRange}`).split(/\r?\n/).filter(Boolean);
  } catch {
    return run("git show --name-only --pretty=format: HEAD").split(/\r?\n/).filter(Boolean);
  }
}

const message = getCommitMessage();
const changedFiles = getChangedFiles();
const skycamOnly = changedFiles.length > 0 && changedFiles.every((file) => (
  file === "public/js/sky-cam/frame.jpg" ||
  file === "public/js/sky-cam/output.json"
));

if (autoRefreshMessages.some((prefix) => message.startsWith(prefix)) && skycamOnly) {
  console.log("Skipping Vercel build for skycam-only refresh. Live page reads skycam data from GitHub raw.");
  process.exit(0);
}

console.log("Continuing Vercel build.");
process.exit(1);
