/**
 * errors.ts — structured error thrown when a bundled dataset does not
 * validate against `@packet-voyage/schema` (CONTRACTS §5.7, VOY-N-05).
 */

/** One Zod-style issue, kept structural so this module does not import zod. */
export interface DatasetIssue {
  path: (string | number)[];
  message: string;
}

export class DatasetError extends Error {
  readonly datasetId: string;
  readonly file: string;
  readonly issues: DatasetIssue[];

  constructor(datasetId: string, file: string, issues: DatasetIssue[]) {
    const detail = issues.slice(0, 5).map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`);
    super(`invalid dataset ${file} (${datasetId}): ${detail.join('; ')}`);
    this.name = 'DatasetError';
    this.datasetId = datasetId;
    this.file = file;
    this.issues = issues;
  }
}

/** Minimal shape of a Zod schema used by the loaders (structural, no zod import). */
export interface SafeParser<T> {
  safeParse(data: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: DatasetIssue[] } };
}
