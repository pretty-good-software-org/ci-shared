export interface VendoredFilePin {
  sha256: string;
  sourcePath: string;
}

export interface OrgLintConfigPin {
  archiveSha256: string;
  vendoredFiles: Record<string, VendoredFilePin>;
  version: string;
}
