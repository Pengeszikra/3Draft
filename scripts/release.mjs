// Publish through the date-based versioner, not a manually entered npm version (the same release as spi3der's and
// spider-paint's). npm computes the package version before prepublishOnly, so bumping there is too late.
//
//   npm run release              bump, build, test, publish to npm, then commit the new version and push it
//   npm run release -- --dry-run only show the next version
//
// The repository is the source of truth, so a release starts from a clean, up-to-date checkout and ends with the
// published version committed back (package.json, src/index.ts and the rebuilt dist/): npm and git never disagree.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dry = process.argv.includes('--dry-run');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPM = npm;
// the files a version bump touches: bump.js writes package.json and src/index.ts, the build writes dist/
const VERSIONED = ['package.json', 'src/index.ts', 'dist'];

const run = (command, args) => {
  const r = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
};
const must = (command, args) => {
  const status = run(command, args);
  if (status !== 0) process.exit(status);
};
const out = (command, args) => {
  const r = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw Error(`${command} ${args.join(' ')}: ${(r.stderr || '').trim()}`);
  return r.stdout.trim();
};
// A release starts from what git has: changed tracked files stop it (they would be published without being committed);
// untracked files only stop it when npm would pack them (they are listed either way).
const stop = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};
const cleanTree = () => {
  const lines = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter(Boolean); // (untrimmed: the status columns)
  const changed = lines.filter((l) => !l.startsWith('??')).map((l) => l.slice(3));
  const untracked = lines.filter((l) => l.startsWith('??')).map((l) => l.slice(3));
  if (changed.length) stop(`uncommitted changes, commit or stash them first:\n  ${changed.join('\n  ')}`);
  if (!untracked.length) return;
  const packed = new Set(JSON.parse(out(NPM, ['pack', '--dry-run', '--json', '--ignore-scripts']))[0].files.map((f) => f.path));
  const shipped = untracked.flatMap((u) => (u.endsWith('/') ? [...packed].filter((f) => f.startsWith(u)) : packed.has(u) ? [u] : []));
  if (shipped.length) stop(`untracked files would be published, commit or remove them first:\n  ${shipped.join('\n  ')}`);
  console.log(`(untracked, not published, left alone: ${untracked.join(', ')})`);
};
const pkg = () => JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

if (dry) {
  // only the next version; nothing is written
  must(process.execPath, ['scripts/bump.js', '--dry']);
} else {
  const { name } = pkg();
  const branch = pkg().release?.branch ?? 'main';
  cleanTree();
  if (out('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== branch) stop(`release from ${branch}`);
  must('git', ['pull', '--ff-only', 'origin', branch]); // the version continues from what the repository has
  const undo = (why) => {
    run('git', ['checkout', '--', ...VERSIONED]);
    console.error(`${why}: the version bump was undone`);
    process.exit(1);
  };
  const original = pkg().version;
  must(process.execPath, ['scripts/bump.js']);
  const target = pkg().version;
  if (target === original) undo('release version was not incremented');
  if (run(npm, ['test']) !== 0) undo('the tests failed'); // (npm test builds dist/ with the new version first)
  if (run(process.execPath, ['scripts/build.mjs', '--check']) !== 0) undo('dist/ does not match src/');
  console.log(`Publishing ${name}@${target}`);
  if (run(npm, ['publish', ...process.argv.slice(2)]) !== 0) undo('npm publish failed');
  must('git', ['add', ...VERSIONED]);
  must('git', ['commit', '-m', `release: ${name}@${target}`]);
  const pushed = run('git', ['push', 'origin', branch]);
  console.log(pushed === 0
    ? `Published ${name}@${target} and pushed the version to ${branch}.`
    : `Published ${name}@${target}; the version commit is local: push it to ${branch}.`);
}
