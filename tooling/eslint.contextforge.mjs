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

const contextforgePlugin = {
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
  ];
}
