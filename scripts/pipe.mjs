// The |> pipeline operator for TypeScript, desugared before the compiler sees it.
//
//   value |> f |> g(1)      ->      g(1)(f(value))
//
// F# style, as in https://dev.to/pengeszikra/pipeline-operator-great-again-1cbn: the right side is
// an expression that evaluates to a function (so `|> filter(state)` is a curried call), and the
// chain is left associative. Write an arrow function on the right in parentheses:
// `x |> ((v) => v + 1)`.
//
// How it works: every `|>` outside strings and comments becomes the unused operator `>>>`, the
// TypeScript parser reads the file, and each `>>>` expression is rewritten to a call by slicing the
// original text. Nothing else in the file changes and the line count is kept.

const STAND_IN = '>>>';

/** Replaces `|>` by `>>>` outside string literals, template literals and comments. */
export const markPipes = (source) => {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const d = source[i + 1];
    if (c === '/' && d === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      out += source.slice(i, stop);
      i = stop;
    } else if (c === '/' && d === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      out += source.slice(i, stop);
      i = stop;
    } else if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]$|^$/.test(out.trimEnd().slice(-1))) {
      // a regular expression literal
      let j = i + 1;
      let inClass = false;
      while (j < n && (inClass || source[j] !== '/')) {
        if (source[j] === '\\') j += 1;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && source[j] !== c) j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
    } else if (c === '|' && d === '>') {
      out += STAND_IN;
      i += 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
};

const needsParens = (ts, node) =>
  !(
    ts.isIdentifier(node) ||
    ts.isCallExpression(node) ||
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
  );

/** Desugars the `|>` operators of a TypeScript source text into plain calls. */
export const desugarPipes = (ts, source, fileName = 'file.ts') => {
  if (!source.includes('|>')) return source;
  const marked = markPipes(source);
  const sf = ts.createSourceFile(fileName, marked, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const render = (node) => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken) {
      const fn = render(node.right);
      const call = `${needsParens(ts, node.right) ? `(${fn})` : fn}(${render(node.left)})`;
      // keep the line count, so errors point at the line of the source
      const lost = marked.slice(node.getStart(sf), node.getEnd()).split('\n').length - call.split('\n').length;
      return call + '\n'.repeat(Math.max(0, lost));
    }
    const start = node.getStart(sf);
    let text = '';
    let at = start;
    ts.forEachChild(node, (child) => {
      const s = child.getStart(sf);
      text += marked.slice(at, s) + render(child);
      at = child.getEnd();
    });
    return text + marked.slice(at, node.getEnd());
  };
  let out = '';
  let at = 0;
  for (const st of sf.statements) {
    const s = st.getStart(sf);
    out += marked.slice(at, s) + render(st);
    at = st.getEnd();
  }
  return out + marked.slice(at);
};
