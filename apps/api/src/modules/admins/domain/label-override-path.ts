// Tenant label overrides spec §4.2 "Path rendering" (#129). Pure: appends
// one stored JSON key to a rejection path as a single line of printable
// ASCII with a bounded length. The result is diagnostic text only: never an
// identity, lookup, de-duplication or validation key.

export const MAX_PATH_KEY_CODE_POINTS = 64;

const BARE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

// `parent` is an already-rendered path, or '' for the top level.
export function appendPathSegment(parent: string, key: string): string {
  // Code points as string iteration counts them: a lone surrogate is one.
  const codePoints = [...key];
  if (BARE_KEY.test(key) && codePoints.length <= MAX_PATH_KEY_CODE_POINTS) {
    return parent === '' ? key : `${parent}.${key}`;
  }
  // Truncate the raw key, count what was dropped, then escape the prefix.
  const prefix = codePoints.slice(0, MAX_PATH_KEY_CODE_POINTS).join('');
  const dropped = codePoints.length - MAX_PATH_KEY_CODE_POINTS;
  const marker = dropped > 0 ? `...(+${dropped})` : '';
  return `${parent}["${escapeKeyPrefix(prefix)}"${marker}]`;
}

// Per UTF-16 code unit. Not JSON.stringify, which leaves C1 controls,
// U+2028/U+2029 and bidirectional controls unescaped.
function escapeKeyPrefix(prefix: string): string {
  let escaped = '';
  for (let index = 0; index < prefix.length; index += 1) {
    const unit = prefix.charCodeAt(index);
    if (unit === 0x22 || unit === 0x5c) {
      escaped += `\\${prefix[index]}`;
    } else if (unit >= 0x20 && unit <= 0x7e) {
      escaped += prefix[index];
    } else {
      escaped += `\\u${unit.toString(16).toUpperCase().padStart(4, '0')}`;
    }
  }
  return escaped;
}
