import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { desugarPipes, markPipes } from './pipe.mjs';
import { findTypeScript } from './build.mjs';

const ts = (await import(pathToFileURL(findTypeScript()).href)).default;
const d = (src) => desugarPipes(ts, src);

test('a chain becomes nested calls, left to right', () => {
  assert.equal(d('const a = 1 |> f |> g(2);'), 'const a = g(2)(f(1));');
});

test('the right side may be a parenthesised arrow function', () => {
  assert.equal(d('const a = 3 |> ((n: number) => n * 2);'), 'const a = ((n: number) => n * 2)(3);');
});

test('|> inside strings, comments and regular expressions is left alone', () => {
  const src = 'const s = "a |> b"; // x |> y\nconst t = `c |> d`; const r = /"|>/;';
  assert.equal(d(src), src);
  assert.equal(markPipes('x |> y // |>'), 'x >>> y // |>');
});

test('nested pipelines in arguments and the line count are kept', () => {
  const out = d('f(x |> g, 2);\nconst t = 5\n  |> add(1)\n  |> neg;\nconst z = 1;');
  assert.match(out, /^f\(g\(x\), 2\);/);
  assert.equal(out.split('\n').length, 5);
  assert.match(out, /neg\(add\(1\)\(5\)/);
});
