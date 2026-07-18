#!/usr/bin/env node

import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const allowedFiles = new Set([
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/workflows/pages.yml",
  ".nojekyll",
  "404.html",
  "CNAME",
  "README.md",
  "index.html",
  "privacy.html",
  "robots.txt",
  "scripts/validate-site.mjs",
  "sitemap.xml",
  "styles.css",
  "support.html",
]);

const requiredText = new Map([
  [
    "index.html",
    [
      "Levelstead",
      "Fitness quests without reckless overtraining.",
      'href="https://levelstead.com/"',
    ],
  ],
  [
    "privacy.html",
    [
      "Levelstead Privacy Policy",
      "support@levelstead.com",
      'href="https://levelstead.com/privacy.html"',
    ],
  ],
  [
    "support.html",
    [
      "Levelstead Support",
      "support@levelstead.com",
      'href="https://levelstead.com/support.html"',
    ],
  ],
  ["404.html", ["Page Not Found · Levelstead", "Quest not found."]],
  ["robots.txt", ["Sitemap: https://levelstead.com/sitemap.xml"]],
  [
    "sitemap.xml",
    [
      "https://levelstead.com/",
      "https://levelstead.com/privacy.html",
      "https://levelstead.com/support.html",
    ],
  ],
]);

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file, files);
    else files.push(file);
  }
  return files;
}

const files = await walk(root);
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const stats = await lstat(file);
  if (stats.isSymbolicLink()) errors.push(`${relative} must not be a symlink`);
  if (!allowedFiles.has(relative))
    errors.push(`${relative} is not public allowlisted`);

  const content = await readFile(file, "utf8");
  for (const [pattern, label] of [
    [/\bRepQuest\b/i, "legacy brand"],
    [/(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{16,}/, "GitHub token"],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
    [/matos312@yahoo\.com/i, "private contact address"],
  ]) {
    if (pattern.test(content)) errors.push(`${relative} contains ${label}`);
  }
}

for (const expected of allowedFiles) {
  if (
    !files.some(
      (file) =>
        path.relative(root, file).split(path.sep).join("/") === expected,
    )
  ) {
    errors.push(`${expected} is missing`);
  }
}

for (const [relative, markers] of requiredText) {
  const content = await readFile(path.join(root, relative), "utf8");
  for (const marker of markers) {
    if (!content.includes(marker))
      errors.push(`${relative} is missing ${marker}`);
  }
}

if (
  (await readFile(path.join(root, "CNAME"), "utf8")).trim() !== "levelstead.com"
) {
  errors.push("CNAME must contain only levelstead.com");
}

for (const error of errors) console.error(`ERROR: ${error}`);
if (errors.length > 0) {
  console.error(`Site validation failed with ${errors.length} error(s).`);
  process.exitCode = 1;
} else {
  console.log("Public Levelstead site validation passed.");
}
