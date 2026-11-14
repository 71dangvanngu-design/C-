export interface CppExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionMs: number;
}

type VarValue = number | string | boolean | number[];

interface ExecContext {
  vars: Map<string, VarValue>;
  tokens: string[];
  tokenIndex: number;
  output: string[];
  steps: number;
}

const MAX_STEPS = 5000;

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function tokenizeInput(stdin: string): string[] {
  const trimmed = stdin.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

function splitTopLevel(expr: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  let current = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar && expr[i - 1] !== '\\') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    if (ch === ')' || ch === ']' || ch === '}') depth--;

    if (depth === 0 && expr.slice(i, i + sep.length) === sep) {
      parts.push(current.trim());
      current = '';
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
}

function evalScalarExpr(raw: string, ctx: ExecContext): VarValue {
  const expr = raw.trim();
  if (!expr) return 0;

  if (expr === 'endl' || expr === '"\\n"' || expr === "'\\n'") return '\n';
  if (expr === 'true') return true;
  if (expr === 'false') return false;

  if (expr.startsWith('"') && expr.endsWith('"') && expr.length >= 2) {
    return expr.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
  if (expr.startsWith("'") && expr.endsWith("'") && expr.length >= 2) {
    return expr.slice(1, -1).replace(/\\n/g, '\n');
  }

  // Vector / array index access e.g. arr[i] or arr.size()
  const sizeMatch = expr.match(/^([a-zA-Z_]\w*)\.size\(\)$/);
  if (sizeMatch) {
    const arr = ctx.vars.get(sizeMatch[1]);
    return Array.isArray(arr) ? arr.length : 0;
  }

  const idxMatch = expr.match(/^([a-zA-Z_]\w*)\[(.+)\]$/);
  if (idxMatch) {
    const arr = ctx.vars.get(idxMatch[1]);
    const idx = Number(evalScalarExpr(idxMatch[2], ctx));
    if (Array.isArray(arr) && Number.isInteger(idx) && idx >= 0 && idx < arr.length) {
      return arr[idx];
    }
    throw new Error(`Index out of bounds reading ${expr}`);
  }

  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return Number(expr);
  }

  if (/^[a-zA-Z_]\w*$/.test(expr)) {
    if (ctx.vars.has(expr)) return ctx.vars.get(expr)!;
    throw new Error(`Undeclared identifier '${expr}'`);
  }

  // Parenthesized expression
  if (expr.startsWith('(') && expr.endsWith(')')) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < expr.length - 1; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') depth--;
      if (depth === 0) {
        wrapsAll = false;
        break;
      }
    }
    if (wrapsAll) return evalScalarExpr(expr.slice(1, -1), ctx);
  }

  // Binary operators ordered by precedence (lowest first)
  const ops = ['||', '&&', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%'];
  for (const op of ops) {
    // Search right-to-left for left-associative evaluation
    let depth = 0;
    let inQuote = false;
    let quoteChar = '';
    for (let i = expr.length - op.length; i >= 1; i--) {
      const ch = expr[i];
      if (inQuote) {
        if (ch === quoteChar && expr[i - 1] !== '\\') inQuote = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
        continue;
      }
      if (ch === ')' || ch === ']') depth++;
      if (ch === '(' || ch === '[') depth--;
      if (depth === 0 && expr.slice(i, i + op.length) === op) {
        const prev = expr[i - 1];
        if ((op === '+' || op === '-') && (prev === '+' || prev === '-' || prev === '*' || prev === '/' || prev === '<' || prev === '>' || prev === '=')) {
          continue;
        }
        if ((op === '<' || op === '>') && (expr[i + 1] === '=' || expr[i - 1] === '<' || expr[i - 1] === '>')) {
          continue;
        }
        const left = evalScalarExpr(expr.slice(0, i), ctx);
        const right = evalScalarExpr(expr.slice(i + op.length), ctx);

        switch (op) {
          case '||': return Boolean(left) || Boolean(right);
          case '&&': return Boolean(left) && Boolean(right);
          case '==': return left === right;
          case '!=': return left !== right;
          case '<=': return Number(left) <= Number(right);
          case '>=': return Number(left) >= Number(right);
          case '<': return Number(left) < Number(right);
          case '>': return Number(left) > Number(right);
          case '+':
            if (typeof left === 'string' || typeof right === 'string') {
              return String(left) + String(right);
            }
            return Number(left) + Number(right);
          case '-': return Number(left) - Number(right);
          case '*': return Number(left) * Number(right);
          case '/': {
            const divisor = Number(right);
            if (divisor === 0) throw new Error('Division by zero');
            return typeof left === 'number' && Number.isInteger(left) && Number.isInteger(divisor)
              ? Math.trunc(left / divisor)
              : Number(left) / divisor;
          }
          case '%': {
            const divisor = Number(right);
            if (divisor === 0) throw new Error('Modulo by zero');
            return Number(left) % divisor;
          }
        }
      }
    }
  }

  throw new Error(`Unsupported expression: ${expr}`);
}

function extractBlock(src: string, openBraceIdx: number): { body: string; endIdx: number } {
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];
    if (inQuote) {
      if (ch === quoteChar && src[i - 1] !== '\\') inQuote = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { body: src.slice(openBraceIdx + 1, i), endIdx: i };
      }
    }
  }
  throw new Error('Unmatched brace "{" in block');
}

function executeStatementList(block: string, ctx: ExecContext): number | null {
  let i = 0;
  const len = block.length;

  const skipWs = () => {
    while (i < len && /\s/.test(block[i])) i++;
  };

  while (i < len) {
    skipWs();
    if (i >= len) break;

    ctx.steps++;
    if (ctx.steps > MAX_STEPS) {
      throw new Error('Execution time limit exceeded (possible infinite loop).');
    }

    // Check control flow: for (...) { ... }
    if (block.slice(i).startsWith('for') && /^for\s*\(/.test(block.slice(i))) {
      const parenStart = block.indexOf('(', i);
      let pDepth = 0;
      let parenEnd = -1;
      for (let k = parenStart; k < len; k++) {
        if (block[k] === '(') pDepth++;
        if (block[k] === ')') {
          pDepth--;
          if (pDepth === 0) {
            parenEnd = k;
            break;
          }
        }
      }
      if (parenEnd === -1) throw new Error('Malformed for-loop header');
      const header = block.slice(parenStart + 1, parenEnd);
      const parts = splitTopLevel(header, ';');
      if (parts.length !== 3) throw new Error('Expected 3 clauses in for(...)');

      let bodyStart = parenEnd + 1;
      while (bodyStart < len && /\s/.test(block[bodyStart])) bodyStart++;
      let loopBody = '';
      if (block[bodyStart] === '{') {
        const extracted = extractBlock(block, bodyStart);
        loopBody = extracted.body;
        i = extracted.endIdx + 1;
      } else {
        const semi = block.indexOf(';', bodyStart);
        if (semi === -1) throw new Error('Missing ";" after single-line for-loop body');
        loopBody = block.slice(bodyStart, semi + 1);
        i = semi + 1;
      }

      if (parts[0]) executeSingleStatement(parts[0], ctx);
      while (true) {
        ctx.steps++;
        if (ctx.steps > MAX_STEPS) {
          throw new Error('Execution time limit exceeded (possible infinite loop).');
        }
        if (parts[1]) {
          const cond = evalScalarExpr(parts[1], ctx);
          if (!cond) break;
        }
        const ret = executeStatementList(loopBody, ctx);
        if (ret !== null) return ret;
        if (parts[2]) executeSingleStatement(parts[2], ctx);
      }
      continue;
    }

    // while (...) { ... }
    if (block.slice(i).startsWith('while') && /^while\s*\(/.test(block.slice(i))) {
      const parenStart = block.indexOf('(', i);
      let pDepth = 0;
      let parenEnd = -1;
      for (let k = parenStart; k < len; k++) {
        if (block[k] === '(') pDepth++;
        if (block[k] === ')') {
          pDepth--;
          if (pDepth === 0) {
            parenEnd = k;
            break;
          }
        }
      }
      if (parenEnd === -1) throw new Error('Malformed while-loop header');
      const condExpr = block.slice(parenStart + 1, parenEnd);
      let bodyStart = parenEnd + 1;
      while (bodyStart < len && /\s/.test(block[bodyStart])) bodyStart++;
      let loopBody = '';
      if (block[bodyStart] === '{') {
        const extracted = extractBlock(block, bodyStart);
        loopBody = extracted.body;
        i = extracted.endIdx + 1;
      } else {
        const semi = block.indexOf(';', bodyStart);
        if (semi === -1) throw new Error('Missing ";" after while body');
        loopBody = block.slice(bodyStart, semi + 1);
        i = semi + 1;
      }

      while (Boolean(evalScalarExpr(condExpr, ctx))) {
        ctx.steps++;
        if (ctx.steps > MAX_STEPS) {
          throw new Error('Execution time limit exceeded (possible infinite loop).');
        }
        const ret = executeStatementList(loopBody, ctx);
        if (ret !== null) return ret;
      }
      continue;
    }

    // if (...) { ... } else { ... }
    if (block.slice(i).startsWith('if') && /^if\s*\(/.test(block.slice(i))) {
      const parenStart = block.indexOf('(', i);
      let pDepth = 0;
      let parenEnd = -1;
      for (let k = parenStart; k < len; k++) {
        if (block[k] === '(') pDepth++;
        if (block[k] === ')') {
          pDepth--;
          if (pDepth === 0) {
            parenEnd = k;
            break;
          }
        }
      }
      if (parenEnd === -1) throw new Error('Malformed if header');
      const condExpr = block.slice(parenStart + 1, parenEnd);

      let bodyStart = parenEnd + 1;
      while (bodyStart < len && /\s/.test(block[bodyStart])) bodyStart++;
      let thenBody = '';
      if (block[bodyStart] === '{') {
        const extracted = extractBlock(block, bodyStart);
        thenBody = extracted.body;
        i = extracted.endIdx + 1;
      } else {
        const semi = block.indexOf(';', bodyStart);
        if (semi === -1) throw new Error('Missing ";" after if body');
        thenBody = block.slice(bodyStart, semi + 1);
        i = semi + 1;
      }

      let elseBody: string | null = null;
      skipWs();
      if (block.slice(i).startsWith('else') && /^else\b/.test(block.slice(i))) {
        let elseStart = i + 4;
        while (elseStart < len && /\s/.test(block[elseStart])) elseStart++;
        if (block[elseStart] === '{') {
          const extracted = extractBlock(block, elseStart);
          elseBody = extracted.body;
          i = extracted.endIdx + 1;
        } else if (/^if\s*\(/.test(block.slice(elseStart))) {
          // Consume the full nested if / else-if / else chain
          let cursor = elseStart;
          while (cursor < len) {
            if (!/^if\s*\(/.test(block.slice(cursor))) break;
            const pStart = block.indexOf('(', cursor);
            let pDepth = 0;
            let pEnd = -1;
            for (let k = pStart; k < len; k++) {
              if (block[k] === '(') pDepth++;
              if (block[k] === ')') {
                pDepth--;
                if (pDepth === 0) {
                  pEnd = k;
                  break;
                }
              }
            }
            if (pEnd === -1) throw new Error('Malformed else if header');
            let bStart = pEnd + 1;
            while (bStart < len && /\s/.test(block[bStart])) bStart++;
            if (block[bStart] === '{') {
              const ext = extractBlock(block, bStart);
              cursor = ext.endIdx + 1;
            } else {
              const sm = block.indexOf(';', bStart);
              if (sm === -1) throw new Error('Missing ";" after else-if body');
              cursor = sm + 1;
            }
            let nextWs = cursor;
            while (nextWs < len && /\s/.test(block[nextWs])) nextWs++;
            if (/^else\b/.test(block.slice(nextWs))) {
              let afterElse = nextWs + 4;
              while (afterElse < len && /\s/.test(block[afterElse])) afterElse++;
              if (/^if\s*\(/.test(block.slice(afterElse))) {
                cursor = afterElse;
                continue;
              } else if (block[afterElse] === '{') {
                const ext = extractBlock(block, afterElse);
                cursor = ext.endIdx + 1;
                break;
              } else {
                const sm = block.indexOf(';', afterElse);
                if (sm === -1) throw new Error('Missing ";" after final else body');
                cursor = sm + 1;
                break;
              }
            }
            break;
          }
          elseBody = block.slice(elseStart, cursor);
          i = cursor;
        } else {
          const semi = block.indexOf(';', elseStart);
          if (semi === -1) throw new Error('Missing ";" after else body');
          elseBody = block.slice(elseStart, semi + 1);
          i = semi + 1;
        }
      }

      if (Boolean(evalScalarExpr(condExpr, ctx))) {
        const ret = executeStatementList(thenBody, ctx);
        if (ret !== null) return ret;
      } else if (elseBody !== null) {
        const ret = executeStatementList(elseBody, ctx);
        if (ret !== null) return ret;
      }
      continue;
    }

    // Simple statement ending with ';'
    let semi = -1;
    let inQuote = false;
    let quoteChar = '';
    for (let k = i; k < len; k++) {
      const ch = block[k];
      if (inQuote) {
        if (ch === quoteChar && block[k - 1] !== '\\') inQuote = false;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
        continue;
      }
      if (ch === ';') {
        semi = k;
        break;
      }
    }
    if (semi === -1) {
      throw new Error(`Syntax error: missing ';' near "${block.slice(i, i + 32).trim()}"`);
    }
    const stmt = block.slice(i, semi).trim();
    i = semi + 1;
    if (!stmt) continue;

    if (stmt.startsWith('return')) {
      const retExpr = stmt.slice(6).trim();
      return retExpr ? Number(evalScalarExpr(retExpr, ctx)) : 0;
    }
    executeSingleStatement(stmt, ctx);
  }

  return null;
}

function executeSingleStatement(stmt: string, ctx: ExecContext): void {
  const s = stmt.trim();
  if (!s) return;

  // cout << ...
  if (/^(std::)?cout\b/.test(s)) {
    const parts = splitTopLevel(s.replace(/^(std::)?cout\s*<<\s*/, ''), '<<');
    for (const part of parts) {
      const val = evalScalarExpr(part, ctx);
      ctx.output.push(String(val));
    }
    return;
  }

  // cin >> ...
  if (/^(std::)?cin\b/.test(s)) {
    const parts = splitTopLevel(s.replace(/^(std::)?cin\s*>>\s*/, ''), '>>');
    for (const part of parts) {
      const varName = part.trim();
      const token = ctx.tokens[ctx.tokenIndex++];
      if (token === undefined) {
        throw new Error(`Input stream exhausted while reading '${varName}'`);
      }
      const existing = ctx.vars.get(varName);
      if (typeof existing === 'string') {
        ctx.vars.set(varName, token);
      } else {
        const num = Number(token);
        ctx.vars.set(varName, Number.isNaN(num) ? token : num);
      }
    }
    return;
  }

  // vector<int> name = { ... };
  const vecInitMatch = s.match(/^(?:std::)?vector\s*<\s*\w+\s*>\s+([a-zA-Z_]\w*)\s*=\s*\{([^}]*)\}$/);
  if (vecInitMatch) {
    const [, name, itemsRaw] = vecInitMatch;
    const nums = itemsRaw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => Number(evalScalarExpr(item, ctx)));
    ctx.vars.set(name, nums);
    return;
  }

  // name.push_back(expr)
  const pushMatch = s.match(/^([a-zA-Z_]\w*)\.push_back\((.+)\)$/);
  if (pushMatch) {
    const arr = ctx.vars.get(pushMatch[1]);
    if (!Array.isArray(arr)) throw new Error(`'${pushMatch[1]}' is not a vector`);
    arr.push(Number(evalScalarExpr(pushMatch[2], ctx)));
    return;
  }

  // Variable declaration: int x = 5, string s = "hi", double d = 1.5, auto x = ...
  const declMatch = s.match(/^(?:const\s+)?(?:int|long(?:\s+long)?|double|float|string|std::string|bool|auto)\s+(.+)$/);
  if (declMatch) {
    const decls = splitTopLevel(declMatch[1], ',');
    for (const d of decls) {
      const eqIdx = d.indexOf('=');
      if (eqIdx === -1) {
        const name = d.trim();
        ctx.vars.set(name, s.startsWith('string') || s.startsWith('std::string') ? '' : 0);
      } else {
        const name = d.slice(0, eqIdx).trim();
        const rhs = d.slice(eqIdx + 1).trim();
        ctx.vars.set(name, evalScalarExpr(rhs, ctx));
      }
    }
    return;
  }

  // Increment / decrement: i++, ++i, i--, --i
  const incMatch = s.match(/^(?:\+\+([a-zA-Z_]\w*)|([a-zA-Z_]\w*)\+\+)$/);
  if (incMatch) {
    const name = incMatch[1] || incMatch[2];
    ctx.vars.set(name, Number(ctx.vars.get(name) ?? 0) + 1);
    return;
  }
  const decMatch = s.match(/^(?:--([a-zA-Z_]\w*)|([a-zA-Z_]\w*)--)$/);
  if (decMatch) {
    const name = decMatch[1] || decMatch[2];
    ctx.vars.set(name, Number(ctx.vars.get(name) ?? 0) - 1);
    return;
  }

  // Compound assignment: x += y, x -= y, x *= y
  const compMatch = s.match(/^([a-zA-Z_]\w*)\s*(\+=|-=|\*=|\/=)\s*(.+)$/);
  if (compMatch) {
    const [, name, op, rhs] = compMatch;
    const cur = Number(ctx.vars.get(name) ?? 0);
    const val = Number(evalScalarExpr(rhs, ctx));
    if (op === '+=') ctx.vars.set(name, cur + val);
    if (op === '-=') ctx.vars.set(name, cur - val);
    if (op === '*=') ctx.vars.set(name, cur * val);
    if (op === '/=') ctx.vars.set(name, Math.trunc(cur / val));
    return;
  }

  // Assignment: x = expr or arr[i] = expr
  const assignIdxMatch = s.match(/^([a-zA-Z_]\w*)\[(.+)\]\s*=\s*(.+)$/);
  if (assignIdxMatch) {
    const [, name, idxExpr, rhs] = assignIdxMatch;
    const arr = ctx.vars.get(name);
    const idx = Number(evalScalarExpr(idxExpr, ctx));
    if (!Array.isArray(arr) || idx < 0 || idx >= arr.length) {
      throw new Error(`Invalid vector assignment '${name}[${idx}]'`);
    }
    arr[idx] = Number(evalScalarExpr(rhs, ctx));
    return;
  }

  const assignMatch = s.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
  if (assignMatch) {
    const [, name, rhs] = assignMatch;
    if (!ctx.vars.has(name)) {
      throw new Error(`Undeclared variable '${name}'`);
    }
    ctx.vars.set(name, evalScalarExpr(rhs, ctx));
    return;
  }

  throw new Error(`Unsupported statement: ${s}`);
}

export function executeCppSimulation(sourceCode: string, stdin = ''): CppExecutionResult {
  const start = Date.now();
  try {
    const cleaned = stripComments(sourceCode);
    const mainMatch = cleaned.match(/int\s+main\s*\([^)]*\)\s*\{/);
    if (!mainMatch || mainMatch.index === undefined) {
      return {
        success: false,
        stdout: '',
        stderr: 'Compile Error: missing entry point "int main()".',
        exitCode: 1,
        executionMs: Date.now() - start,
      };
    }

    const braceIdx = cleaned.indexOf('{', mainMatch.index);
    const { body } = extractBlock(cleaned, braceIdx);

    const ctx: ExecContext = {
      vars: new Map(),
      tokens: tokenizeInput(stdin),
      tokenIndex: 0,
      output: [],
      steps: 0,
    };

    const exitCode = executeStatementList(body, ctx) ?? 0;

    return {
      success: true,
      stdout: ctx.output.join(''),
      stderr: '',
      exitCode,
      executionMs: Math.max(1, Date.now() - start),
    };
  } catch (err) {
    return {
      success: false,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      exitCode: 1,
      executionMs: Math.max(1, Date.now() - start),
    };
  }
}

export interface CppPreset {
  id: string;
  title: string;
  description: string;
  code: string;
  stdin: string;
}

export const CPP_LAB_PRESETS: CppPreset[] = [
  {
    id: 'memory-pointers',
    title: 'Vector & Stack Buffer Trace',
    description: 'Inspect contiguous vector indexing and accumulator computation.',
    stdin: '',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> blocks = {64, 128, 256, 512};
    int total = 0;

    for (int i = 0; i < blocks.size(); i++) {
        total += blocks[i];
        cout << "Segment[" << i << "] = " << blocks[i] << " KB" << endl;
    }

    cout << "Total Allocated: " << total << " KB" << endl;
    return 0;
}`,
  },
  {
    id: 'binary-search',
    title: 'Binary Search in Sorted Array',
    description: 'Logarithmic O(log N) lookup with stdin target value.',
    stdin: '42',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    vector<int> nums = {4, 11, 19, 27, 42, 58, 73, 91};
    int target;
    cin >> target;

    int left = 0;
    int right = nums.size() - 1;
    int found = -1;

    while (left <= right) {
        int mid = (left + right) / 2;
        if (nums[mid] == target) {
            found = mid;
            left = right + 1;
        } else if (nums[mid] < target) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    if (found != -1) {
        cout << "Target " << target << " located at index " << found << endl;
    } else {
        cout << "Target " << target << " not found in buffer" << endl;
    }
    return 0;
}`,
  },
  {
    id: 'fibonacci',
    title: 'Iterative Fibonacci Sequence',
    description: 'Dynamic state transitions using O(1) auxiliary variables.',
    stdin: '8',
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;
    int a = 0;
    int b = 1;

    for (int i = 0; i < n; i++) {
        cout << a << " ";
        int next = a + b;
        a = b;
        b = next;
    }
    cout << endl;
    return 0;
}`,
  },
];
