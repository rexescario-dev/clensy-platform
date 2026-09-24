/**
 * Managed ESLint flat-config *fragment* only.
 *
 * Do not use this file as the project's sole `eslint.config.*`. Keep a
 * project-owned config that calls this factory with that package's own
 * `eslint` / `typescript-eslint` imports (so module resolution stays in
 * the app or package, not under `tooling/`), for example:
 *
 *     import eslint from '@eslint/js';
 *     import tseslint from 'typescript-eslint';
 *     import { contextforgeJavascript } from '../../tooling/eslint.contextforge.mjs';
 *     export default tseslint.config(
 *       { ignores: ['dist/**', 'node_modules/**'] },
 *       ...contextforgeJavascript({ eslint, tseslint }),
 *     );
 *
 * Requires `eslint` and `typescript-eslint` in the destination package.
 * This file does not install those packages.
 */

/** @param {string} name */
export function contextforgeKeyRank(name) {
  if (name === 'id') {
    return 0;
  }
  if (isForeignIdKey(name)) {
    return 1;
  }
  return 2;
}

/** @param {string} name */
function isForeignIdKey(name) {
  if (/_id$/.test(name)) {
    return true;
  }
  if (!/[a-z0-9]Id$/.test(name)) {
    return false;
  }
  // Booleans like isId / hasId are not identifier keys.
  return !/^(is|has|can|should)[A-Z]/.test(name);
}

/**
 * @param {string} a
 * @param {string} b
 */
export function contextforgeCompareKeys(a, b) {
  const rank = contextforgeKeyRank(a) - contextforgeKeyRank(b);
  if (rank !== 0) {
    return rank;
  }
  return String(a).localeCompare(String(b), 'en', {
    numeric: true,
    sensitivity: 'variant',
  });
}

/**
 * Declaration groups. Constructors and accessor properties are not
 * visibility groups. Methods fall through to public / protected / private.
 * `kind` defaults to `method` so callers that only know visibility still work.
 *
 * @param {{ kind?: 'constructor' | 'accessor' | 'method', accessibility?: 'public' | 'protected' | 'private' }} member
 */
export function contextforgeFunctionGroupRank(member) {
  const kind = member.kind ?? 'method';
  if (kind === 'constructor') {
    return 0;
  }
  if (kind === 'accessor') {
    return 1;
  }
  if (member.accessibility === 'protected') {
    return 3;
  }
  if (member.accessibility === 'private') {
    return 4;
  }
  return 2;
}

/**
 * @param {'public' | 'protected' | 'private'} accessibility
 */
export function contextforgeFunctionVisibilityRank(accessibility) {
  if (accessibility === 'public') {
    return 0;
  }
  if (accessibility === 'protected') {
    return 1;
  }
  return 2;
}

/**
 * Total order: constructor, then getter/setter properties by name,
 * then public, protected, and private methods by name.
 * Equal names compare as 0 so overloads and an existing get/set pair
 * keep their source order. `static` is not its own group.
 *
 * @param {{ name: string, kind?: 'constructor' | 'accessor' | 'method', accessibility?: 'public' | 'protected' | 'private', index?: number }} a
 * @param {{ name: string, kind?: 'constructor' | 'accessor' | 'method', accessibility?: 'public' | 'protected' | 'private', index?: number }} b
 */
export function contextforgeCompareFunctions(a, b) {
  const rank = contextforgeFunctionGroupRank(a) - contextforgeFunctionGroupRank(b);
  if (rank !== 0) {
    return rank;
  }
  if ((a.kind ?? 'method') === 'constructor') {
    return (a.index ?? 0) - (b.index ?? 0);
  }
  const byName = String(a.name).localeCompare(String(b.name), 'en', {
    numeric: true,
    sensitivity: 'variant',
  });
  if (byName !== 0) {
    return byName;
  }
  return (a.index ?? 0) - (b.index ?? 0);
}

/**
 * @param {import('estree').Node} node
 * @returns {'public' | 'protected' | 'private'}
 */
function functionAccessibility(node) {
  if (
    node.accessibility === 'public' ||
    node.accessibility === 'protected' ||
    node.accessibility === 'private'
  ) {
    return node.accessibility;
  }
  if (node.key && node.key.type === 'PrivateIdentifier') {
    return 'private';
  }
  return 'public';
}

/**
 * @param {import('estree').Node} node
 * @returns {string | null}
 */
function functionName(node) {
  const key = node.key;
  if (!key || node.computed) {
    return null;
  }
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name;
  }
  if (key.type === 'Literal' || key.type === 'StringLiteral') {
    return String(key.value);
  }
  return null;
}

/**
 * Class constructors, getters, setters, methods, and function-valued
 * properties. Other fields are ignored so this stays a function order.
 * A missing visibility modifier is public. `#private` is private.
 * Getters and setters use the property name so a pair sorts as one group.
 *
 * @param {import('estree').Node} node
 * @returns {{ name: string, kind: 'constructor' | 'accessor' | 'method', accessibility: 'public' | 'protected' | 'private', node: import('estree').Node } | null}
 */
function classFunctionMember(node) {
  let kind = 'method';
  if (
    node.type === 'MethodDefinition' ||
    node.type === 'TSAbstractMethodDefinition'
  ) {
    if (node.kind === 'constructor') {
      kind = 'constructor';
    } else if (node.kind === 'get' || node.kind === 'set') {
      kind = 'accessor';
    }
  } else if (
    node.type === 'PropertyDefinition' ||
    node.type === 'TSAbstractPropertyDefinition' ||
    node.type === 'AccessorProperty'
  ) {
    const value = node.value;
    if (
      !value ||
      (value.type !== 'ArrowFunctionExpression' &&
        value.type !== 'FunctionExpression')
    ) {
      return null;
    }
  } else {
    return null;
  }

  const name = kind === 'constructor' ? 'constructor' : functionName(node);
  if (!name) {
    return null;
  }
  return {
    name,
    kind,
    accessibility: functionAccessibility(node),
    node,
  };
}

/**
 * @param {import('estree').Node} node
 * @returns {{ name: string } | { computed: true } | { spread: true } | null}
 */
function memberKey(node) {
  if (
    node.type === 'SpreadElement' ||
    node.type === 'RestElement' ||
    node.type === 'TSIndexSignature' ||
    node.type === 'TSCallSignatureDeclaration' ||
    node.type === 'TSConstructSignatureDeclaration'
  ) {
    return { spread: true };
  }
  const key = node.key ?? node.argument;
  if (node.computed) {
    return { computed: true };
  }
  if (!key) {
    return { computed: true };
  }
  if (key.type === 'Identifier') {
    return { name: key.name };
  }
  if (key.type === 'Literal' || key.type === 'StringLiteral') {
    return { name: String(key.value) };
  }
  return { computed: true };
}

function hasBlankLineBetween(source, prev, next) {
  return /\n[ \t]*\n/.test(source.slice(prev.range[1], next.range[0]));
}

export const contextforgePlugin = {
  meta: { name: 'contextforge' },
  rules: {
    'record-key-order': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Require record keys in the order: id, other *Id / *_id keys, then remaining keys naturally.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              allowLineSeparatedGroups: { type: 'boolean' },
              ignoreComputedKeys: { type: 'boolean' },
              minKeys: { type: 'integer', minimum: 2 },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          sortKeys:
            "Expected '{{thisName}}' to come before '{{prevName}}' (id, then sorted id keys, then remaining keys).",
        },
      },
      create(context) {
        const options = context.options[0] ?? {};
        const minKeys = options.minKeys ?? 4;
        const allowLineSeparatedGroups = options.allowLineSeparatedGroups !== false;
        const ignoreComputedKeys = options.ignoreComputedKeys !== false;
        const source =
          context.sourceCode?.getText() ?? context.getSourceCode().getText();

        function checkList(nodes) {
          const named = nodes.filter((n) => memberKey(n)?.name);
          if (named.length < minKeys) {
            return;
          }

          let prev = null;
          for (const node of nodes) {
            const info = memberKey(node);
            if (!info) {
              prev = null;
              continue;
            }
            if (info.spread || (info.computed && ignoreComputedKeys)) {
              prev = null;
              continue;
            }
            if (info.computed) {
              prev = null;
              continue;
            }
            if (
              prev &&
              allowLineSeparatedGroups &&
              hasBlankLineBetween(source, prev.node, node)
            ) {
              prev = { node, name: info.name };
              continue;
            }
            if (prev && contextforgeCompareKeys(info.name, prev.name) < 0) {
              context.report({
                node,
                messageId: 'sortKeys',
                data: { thisName: info.name, prevName: prev.name },
              });
            }
            prev = { node, name: info.name };
          }
        }

        return {
          ObjectExpression(node) {
            checkList(node.properties);
          },
        };
      },
    },
    'function-order': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Require constructor, then getter/setter properties by name, then public, protected, and private methods by name. Does not reorder non-function fields.',
        },
        schema: [],
        messages: {
          sortFunctions:
            "Expected '{{thisName}}' to come before '{{prevName}}' (constructor, then getter/setter properties, then public, protected, and private methods).",
        },
      },
      create(context) {
        function checkFunctions(functions) {
          let prev = null;
          for (const fn of functions) {
            if (prev && contextforgeCompareFunctions(fn, prev) < 0) {
              context.report({
                node: fn.node,
                messageId: 'sortFunctions',
                data: { thisName: fn.name, prevName: prev.name },
              });
            }
            prev = fn;
          }
        }

        return {
          ClassBody(node) {
            const functions = [];
            for (const member of node.body) {
              const fn = classFunctionMember(member);
              if (!fn) {
                continue;
              }
              functions.push({ ...fn, index: functions.length });
            }
            checkFunctions(functions);
          },
          Program(node) {
            const functions = [];
            for (const stmt of node.body) {
              const exported =
                stmt.type === 'ExportNamedDeclaration' ||
                stmt.type === 'ExportDefaultDeclaration';
              const decl = exported ? stmt.declaration : stmt;
              if (!decl || decl.type !== 'FunctionDeclaration' || !decl.id) {
                continue;
              }
              functions.push({
                name: decl.id.name,
                kind: 'method',
                accessibility: exported ? 'public' : 'private',
                index: functions.length,
                node: decl,
              });
            }
            checkFunctions(functions);
          },
        };
      },
    },
  },
};

export function contextforgeJavascript({ eslint, tseslint }) {
  return [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
      plugins: { contextforge: contextforgePlugin },
      rules: {
        '@typescript-eslint/sort-type-constituents': 'error',
        // Core sort-keys is alphabetical-only. Use id-first order instead.
        'sort-keys': 'off',
        // Four or more keys. Blank-line groups and computed/spread keys
        // reset the run. Do not apply when insertion order matters.
        'contextforge/record-key-order': [
          'error',
          {
            allowLineSeparatedGroups: true,
            ignoreComputedKeys: true,
            minKeys: 4,
          },
        ],
      },
    },
    {
      // Declaration order only. `src/` so tests and package-root scripts
      // stay out. Migrations live under `src/` and keep `up` then `down`.
      files: ['src/**/*.{js,mjs,cjs,ts,tsx,jsx}'],
      ignores: ['src/**/migrations/**', 'src/**/generated/**'],
      plugins: { contextforge: contextforgePlugin },
      rules: {
        'contextforge/function-order': 'error',
      },
    },
  ];
}
