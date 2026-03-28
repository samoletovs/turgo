#!/usr/bin/env node
/**
 * Pre-deployment validation script for Turgo.
 *
 * Run before pushing to main to catch the same errors that CI would catch:
 *   npm run predeploy
 *
 * Checks performed:
 *   1. Prisma client generation (schema → types in sync)
 *   2. ESLint (code quality & Next.js best practices)
 *   3. TypeScript type checking (strict, no emit)
 *   4. Next.js production build (catches SSR / import errors)
 *   5. Unit tests via Vitest (if any test files exist)
 *   6. Prisma schema validation (no syntax errors)
 *   7. Environment variable check (required vars present)
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const startTime = Date.now();

// ── Helpers ────────────────────────────────────────────────
const PASS = "\x1b[32m✓\x1b[0m";
const FAIL = "\x1b[31m✗\x1b[0m";
const WARN = "\x1b[33m⚠\x1b[0m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

let failures = 0;
let warnings = 0;

function header(text) {
  console.log(`\n${BOLD}── ${text} ──${RESET}`);
}

function run(label, command, { optional = false, warnOnly = false } = {}) {
  process.stdout.write(`  ${label}... `);
  try {
    execSync(command, {
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        // Dummy DATABASE_URL so Prisma Client can initialize during build
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://build:build@localhost:5432/build",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "production",
      },
      timeout: 300_000, // 5 min max per step
    });
    console.log(`${PASS}`);
    return true;
  } catch (err) {
    if (warnOnly) {
      console.log(`${WARN} (warning)`);
      warnings++;
      const stderr = err.stderr?.toString().trim();
      if (stderr) {
        console.log(`    ${stderr.split("\n").slice(0, 8).join("\n    ")}`);
      }
      return true;
    }
    if (optional) {
      console.log(`${WARN} skipped`);
      return true;
    }
    console.log(`${FAIL}`);
    failures++;
    const stderr = err.stderr?.toString().trim();
    const stdout = err.stdout?.toString().trim();
    const output = stderr || stdout;
    if (output) {
      console.log(`    ${output.split("\n").slice(0, 20).join("\n    ")}`);
    }
    return false;
  }
}

// ── Checks ─────────────────────────────────────────────────
console.log(
  `\n${BOLD}🔍 Turgo Pre-Deployment Validation${RESET}\n` +
    `   Running all checks that CI will run...\n`
);

// 1. Prisma
header("Prisma");
run("Schema validation", "npx prisma validate");
run("Client generation", "npx prisma generate");

// 2. Lint
header("Code Quality");
run("ESLint", "npx eslint --max-warnings 0");
run(
  "Prettier format check",
  'npx prettier --check "src/**/*.{ts,tsx,json,css}"',
  { warnOnly: true }
);

// 3. Type check
header("Type Safety");
run("TypeScript (tsc --noEmit)", "npx tsc --noEmit");

// 4. Tests
header("Tests");
const hasTestFiles = (() => {
  try {
    const result = execSync(
      'npx glob "src/**/*.{test,spec}.{ts,tsx}" --count',
      { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] }
    );
    return parseInt(result.toString().trim(), 10) > 0;
  } catch {
    // Fallback: check common test dirs
    return (
      existsSync(join(ROOT, "src", "__tests__")) ||
      existsSync(join(ROOT, "tests"))
    );
  }
})();
if (hasTestFiles) {
  run("Vitest unit tests", "npx vitest run --reporter=verbose");
} else {
  console.log(`  ${WARN} No test files found — skipping tests`);
  warnings++;
}

// 5. Build
header("Production Build");
run("Next.js build", "npm run build");

// 6. Docker (optional — only if Docker is available)
header("Docker");
const dockerAvailable = (() => {
  try {
    execSync("docker --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();
if (dockerAvailable) {
  run("Docker build", "docker build -t turgo:predeploy-test .", {
    warnOnly: true,
  });
} else {
  console.log(`  ${WARN} Docker not available — skipping container build`);
  warnings++;
}

// 7. Environment variables check
header("Environment Variables");
const requiredEnvVars = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
];
const optionalEnvVars = [
  "REDIS_URL",
  "MEILISEARCH_HOST",
  "MEILISEARCH_API_KEY",
  "AZURE_STORAGE_CONNECTION_STRING",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY",
];

const missingRequired = requiredEnvVars.filter((v) => !process.env[v]);
const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);

if (missingRequired.length === 0) {
  console.log(`  ${PASS} All required env vars present`);
} else {
  console.log(
    `  ${WARN} Missing required env vars (needed for production): ${missingRequired.join(", ")}`
  );
  warnings++;
}
if (missingOptional.length > 0) {
  console.log(
    `  ${WARN} Missing optional env vars: ${missingOptional.join(", ")}`
  );
}

// ── Summary ────────────────────────────────────────────────
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n${"─".repeat(50)}`);

if (failures === 0) {
  console.log(
    `\n${BOLD}${PASS} All checks passed!${RESET} (${elapsed}s)` +
      (warnings > 0 ? ` — ${warnings} warning(s)` : "")
  );
  console.log(`\n  You're safe to push to main. 🚀\n`);
  process.exit(0);
} else {
  console.log(
    `\n${BOLD}${FAIL} ${failures} check(s) failed${RESET} (${elapsed}s)` +
      (warnings > 0 ? ` — ${warnings} warning(s)` : "")
  );
  console.log(
    `\n  Fix the errors above before pushing. These would fail CI.\n`
  );
  process.exit(1);
}
