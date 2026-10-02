// #92 typed outcome contract (decision 8). Every gate call is classified
// into exactly one outcome; whatever this file cannot classify is
// UNEXPECTED and fails every phase. Phases interpret outcomes (decision 10):
// e.g. ERROR is "declared domain rejection" only in the role phase and a
// declared MISSING form only in the cross-tenant phase.
export type Outcome =
  | { detail: string; kind: 'UNEXPECTED' }
  | { ids: string[]; kind: 'OK'; totalCount: number | null }
  | { kind: 'ERROR'; message: string; status: number }
  | { kind: 'FORBIDDEN' }
  | { kind: 'NULL' }
  | { kind: 'UNAUTHENTICATED' };

interface GraphqlError {
  extensions?: {
    code?: string;
    originalError?: { statusCode?: number };
    status?: number;
  };
  message?: string;
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
};

function unexpected(detail: string, body: unknown): Outcome {
  return {
    detail: `${detail}: ${JSON.stringify(body).slice(0, 500)}`,
    kind: 'UNEXPECTED',
  };
}

function okFrom(value: unknown, body: unknown): Outcome {
  const idOf = (node: unknown): string | null =>
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { id?: unknown }).id === 'string'
      ? (node as { id: string }).id
      : null;
  const idsOf = (nodes: unknown[]): string[] | null => {
    const ids = nodes.map(idOf);
    return ids.every((id): id is string => id !== null) ? ids : null;
  };
  if (Array.isArray(value)) {
    const ids = idsOf(value);
    return ids
      ? { ids, kind: 'OK', totalCount: null }
      : unexpected('array without ids', body);
  }
  if (typeof value === 'object' && value !== null) {
    const { nodes, totalCount } = value as {
      nodes?: unknown;
      totalCount?: unknown;
    };
    if (Array.isArray(nodes)) {
      const ids = idsOf(nodes);
      return ids && typeof totalCount === 'number'
        ? { ids, kind: 'OK', totalCount }
        : unexpected('connection without ids or totalCount', body);
    }
    const id = idOf(value);
    return id
      ? { ids: [id], kind: 'OK', totalCount: null }
      : unexpected('object without id', body);
  }
  return unexpected('scalar result', body);
}

function fromStatus(status: number, message: string, body: unknown): Outcome {
  if (status === 401) return { kind: 'UNAUTHENTICATED' };
  if (status === 403) return { kind: 'FORBIDDEN' };
  if (status >= 400 && status < 500) return { kind: 'ERROR', message, status };
  return unexpected(`status ${status}`, body);
}

export function classifyGraphql(body: unknown, field: string): Outcome {
  const { data, errors } = (body ?? {}) as {
    data?: Record<string, unknown> | null;
    errors?: GraphqlError[];
  };
  if (errors && errors.length > 0) {
    if (errors.length !== 1) return unexpected(`${errors.length} errors`, body);
    if (data && data[field] != null)
      return unexpected('error with partial data', body);
    const [error] = errors;
    const code = error.extensions?.code;
    const reported =
      error.extensions?.status ?? error.extensions?.originalError?.statusCode;
    const fromCode = code === undefined ? undefined : STATUS_BY_CODE[code];
    if (
      reported !== undefined &&
      fromCode !== undefined &&
      reported !== fromCode
    ) {
      return unexpected(`code ${code} disagrees with status ${reported}`, body);
    }
    const status = reported ?? fromCode;
    if (status === undefined)
      return unexpected(`unclassified error (code ${code})`, body);
    return fromStatus(status, error.message ?? '', body);
  }
  if (!data || !(field in data)) return unexpected(`no data.${field}`, body);
  return data[field] === null ? { kind: 'NULL' } : okFrom(data[field], body);
}

export function classifyRest(status: number, body: unknown): Outcome {
  if (status >= 200 && status < 300) return okFrom(body, body);
  const raw = (body as { message?: unknown } | null)?.message;
  const message = Array.isArray(raw)
    ? raw.join('; ')
    : typeof raw === 'string'
      ? raw
      : JSON.stringify(raw ?? '');
  return fromStatus(status, message, body);
}

export function normalizeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'ERROR':
      return `ERROR ${outcome.status} ${outcome.message.replace(UUID_PATTERN, '<uuid>')}`;
    case 'OK':
      return `OK ids=${outcome.ids.length} total=${outcome.totalCount}`;
    case 'UNEXPECTED':
      return `UNEXPECTED ${outcome.detail.replace(UUID_PATTERN, '<uuid>')}`;
    default:
      return outcome.kind;
  }
}

export function describeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'ERROR':
      return `ERROR ${outcome.status} "${outcome.message}"`;
    case 'OK':
      return `OK ids=[${outcome.ids.join(', ')}] totalCount=${outcome.totalCount}`;
    case 'UNEXPECTED':
      return `UNEXPECTED ${outcome.detail}`;
    default:
      return outcome.kind;
  }
}
