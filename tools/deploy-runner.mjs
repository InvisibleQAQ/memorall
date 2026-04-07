#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

const rootDir = process.cwd();
const sourceDir = resolve(rootDir, 'runner');
const branch = 'gh-pages';
const remote = 'origin';
const dryRun = process.argv.includes('--dry-run');

if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}

function formatCommand(command, args) {
  return [command, ...args].join(' ');
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    const output = stderr || stdout;
    const prefix = `Command failed: ${formatCommand(command, args)}`;
    throw new Error(output ? `${prefix}\n${output}` : prefix);
  }

  return options.capture ? result.stdout.trim() : '';
}

function tryRun(command, args, options = {}) {
  try {
    return run(command, args, options);
  } catch {
    return null;
  }
}

function clearDirectory(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') {
      continue;
    }

    rmSync(join(dir, entry.name), { recursive: true, force: true });
  }
}

function copyDirectoryContents(fromDir, toDir) {
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    cpSync(join(fromDir, entry.name), join(toDir, entry.name), {
      recursive: true,
    });
  }
}

function configureGitIdentity(repoDir) {
  const userName =
    tryRun('git', ['config', '--get', 'user.name'], { capture: true }) ?? '';
  const userEmail =
    tryRun('git', ['config', '--get', 'user.email'], { capture: true }) ?? '';

  if (userName) {
    run('git', ['config', 'user.name', userName], { cwd: repoDir });
  }

  if (userEmail) {
    run('git', ['config', 'user.email', userEmail], { cwd: repoDir });
  }
}

const tempDir = mkdtempSync(join(tmpdir(), 'memorall-runner-deploy-'));

try {
  const remoteUrl = run('git', ['remote', 'get-url', remote], { capture: true });

  console.log(`Preparing ${branch} deployment from ${sourceDir}`);
  run('git', ['init', '-q'], { cwd: tempDir });
  run('git', ['remote', 'add', remote, remoteUrl], { cwd: tempDir });

  const fetchedBranch = tryRun('git', ['fetch', remote, branch], {
    cwd: tempDir,
    capture: true,
  });

  if (fetchedBranch !== null) {
    run('git', ['checkout', '-B', branch, 'FETCH_HEAD'], { cwd: tempDir });
  } else {
    run('git', ['checkout', '--orphan', branch], { cwd: tempDir });
  }

  clearDirectory(tempDir);
  copyDirectoryContents(sourceDir, tempDir);

  configureGitIdentity(tempDir);

  run('git', ['add', '-A'], { cwd: tempDir });

  const hasChanges = run('git', ['status', '--porcelain'], {
    cwd: tempDir,
    capture: true,
  });

  if (!hasChanges) {
    console.log('No changes to publish.');
    process.exit(0);
  }

  run('git', ['commit', '-m', 'Deploy runner'], { cwd: tempDir });

  if (dryRun) {
    console.log('Dry run complete. Skipping push.');
    process.exit(0);
  }

  run('git', ['push', remote, `${branch}:${branch}`, '--force'], {
    cwd: tempDir,
  });

  console.log(`Published runner to ${branch}.`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
