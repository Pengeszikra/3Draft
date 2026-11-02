// Builds src/*.ts into dist/*.js + dist/*.d.ts.
//
//   node scripts/build.mjs            build
//   node scripts/build.mjs --check    fail when dist/ is out of date (nothing is written)
//
// Steps: every |> in a source is desugared to plain calls (scripts/pipe.mjs) into .build/src, then
// the TypeScript compiler type checks that and emits the JavaScript and the declaration files.
// TypeScript is found through TYPESCRIPT (path to typescript.js), the `typescript` package, or a
// global install, like hexaw-core.js is found for the kernel build.

import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname, relative } from 'node:path';
import { desugarPipes } from './pipe.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(root, 'src');
const STAGE = join(root, '.build', 'src');
const DIST = join(root, 'dist');

export const findTypeScript = () => {
  const require = createRequire(import.meta.url);
  const candidates = [process.env.TYPESCRIPT, () => require.resolve('typescript'), '/opt/npm-tools/node_modules/typescript/lib/typescript.js'];
  for (const c of candidates) {
    try {
      const p = typeof c === 'function' ? c() : c;
      if (p && existsSync(p)) return p;
    } catch {}
  }
  throw new Error('typescript not found: npm install, or set TYPESCRIPT=/path/to/typescript/lib/typescript.js');
};

const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

/** Compiles the sources and returns { files: Map(path -> text), diagnostics: string[] }. */
export const compile = async () => {
  const tsPath = findTypeScript();
  const ts = (await import(pathToFileURL(tsPath).href)).default;

  rmSync(join(root, '.build'), { recursive: true, force: true });
  const sources = walk(SRC).filter((f) => f.endsWith('.ts'));
  const staged = [];
  for (const file of sources) {
    const out = join(STAGE, relative(SRC, file));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, file.endsWith('.d.ts') ? readFileSync(file, 'utf8') : desugarPipes(ts, readFileSync(file, 'utf8'), file));
    staged.push(out);
  }

  // @types/node sits next to typescript in a global install
  const typeRoots = [join(root, 'node_modules', '@types'), join(dirname(dirname(dirname(tsPath))), '@types')].filter(existsSync);
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts'],
    types: ['node'],
    typeRoots,
    strict: true,
    declaration: true,
    skipLibCheck: true,
    rootDir: STAGE,
    outDir: DIST,
    newLine: ts.NewLineKind.LineFeed,
  };
  const files = new Map();
  const diagnostics = [];
  // The engine is compiled strictly. The tests are plain scripts with literals, so they get a
  // relaxed program (no implicit any / null checks) but are still checked against the engine's types.
  for (const [group, extra] of [
    [staged.filter((f) => !f.endsWith('.test.ts')), {}],
    [[...staged.filter((f) => f.endsWith('.test.ts')), ...staged.filter((f) => f.endsWith('.d.ts'))], { strict: false, noImplicitAny: false, declaration: false }],
  ]) {
    const opts = { ...options, ...extra };
    const host = ts.createCompilerHost(opts);
    host.writeFile = (name, text) => files.set(name, text);
    const program = ts.createProgram(group, opts, host);
    const result = program.emit();
    for (const d of ts.getPreEmitDiagnostics(program).concat(result.diagnostics)) {
      const text = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      if (!d.file) diagnostics.push(text);
      else {
        const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
        diagnostics.push(`${relative(root, d.file.fileName).replace('.build/src', 'src')}:${line + 1}:${character + 1} TS${d.code}: ${text}`);
      }
    }
  }
  return { files, diagnostics };
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, diagnostics } = await compile();
  if (diagnostics.length) {
    console.error(diagnostics.join('\n'));
    console.error(`\n${diagnostics.length} problem(s)`);
    process.exit(1);
  }
  if (process.argv.includes('--check')) {
    const stale = [...files].filter(([name, text]) => !existsSync(name) || readFileSync(name, 'utf8') !== text).map(([name]) => relative(root, name));
    const extra = existsSync(DIST) ? walk(DIST).filter((f) => !files.has(f)).map((f) => relative(root, f)) : [];
    if (stale.length || extra.length) {
      console.error(`dist/ is out of date, run npm run build:\n${[...stale, ...extra].join('\n')}`);
      process.exit(1);
    }
    console.log(`dist ok, ${files.size} files`);
  } else {
    rmSync(DIST, { recursive: true, force: true });
    for (const [name, text] of files) {
      mkdirSync(dirname(name), { recursive: true });
      writeFileSync(name, text);
    }
    console.log(`built ${files.size} files -> dist/`);
  }
  rmSync(join(root, '.build'), { recursive: true, force: true });
}
