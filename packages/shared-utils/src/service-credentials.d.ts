export function readServiceCredential(options?: {
  value?: string | null;
  filePath?: string | null;
  label?: string;
}): string | null;

export function readServiceCredentialMap(options?: {
  value?: Record<string, string> | string | null;
  filePath?: string | null;
  label?: string;
}): Readonly<Record<string, string>> | null;

export function credentialsMatch(supplied: string | null | undefined, expected: string | null | undefined): boolean;

export function createServiceCredentialHeaders(options?: {
  token?: string | null;
  caller?: string | null;
  extraHeaders?: Record<string, string>;
}): Record<string, string>;
