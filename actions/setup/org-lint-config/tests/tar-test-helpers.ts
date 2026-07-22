const { gzipSync } = require("node:zlib");

const TAR_BLOCK_BYTES = 512;
const TRAILER_BLOCK_COUNT = 2;
const OCTAL_RADIX = 8;
const DEFAULT_FILE_MODE = 0o644;
const CHECKSUM_SPACE = 0x20;
const FILE_TYPE = "0";
const NAME_FIELD = { length: 100, start: 0 };
const MODE_FIELD = { length: 8, start: 100 };
const USER_FIELD = { length: 8, start: 108 };
const GROUP_FIELD = { length: 8, start: 116 };
const SIZE_FIELD = { length: 12, start: 124 };
const TIME_FIELD = { length: 12, start: 136 };
const CHECKSUM_FIELD = { length: 8, start: 148 };
const TYPE_FIELD = { length: 1, start: 156 };
const MAGIC_FIELD = { length: 6, start: 257 };
const VERSION_FIELD = { length: 2, start: 263 };
const CHECKSUM_DIGITS = 6;

interface TestTarEntry {
  data?: Buffer | string;
  mode?: number;
  name: string;
  type?: string;
}

interface TarField {
  length: number;
  start: number;
}

const writeOctal = (header: Buffer, value: number, field: TarField): void => {
  const octal = value.toString(OCTAL_RADIX).padStart(field.length - 1, "0");
  header.write(octal, field.start, field.length - 1, "ascii");
  header[field.start + field.length - 1] = 0;
};

const entryData = (entry: TestTarEntry): Buffer => {
  if (Buffer.isBuffer(entry.data)) {
    return entry.data;
  }
  return Buffer.from(entry.data || "");
};

const writeMetadata = (header: Buffer, entry: TestTarEntry, data: Buffer): void => {
  header.write(entry.name, NAME_FIELD.start, NAME_FIELD.length, "utf8");
  writeOctal(header, entry.mode ?? DEFAULT_FILE_MODE, MODE_FIELD);
  writeOctal(header, 0, USER_FIELD);
  writeOctal(header, 0, GROUP_FIELD);
  writeOctal(header, data.length, SIZE_FIELD);
  writeOctal(header, 0, TIME_FIELD);
};

const writeFormat = (header: Buffer, entry: TestTarEntry): void => {
  header.fill(CHECKSUM_SPACE, CHECKSUM_FIELD.start, CHECKSUM_FIELD.start + CHECKSUM_FIELD.length);
  header.write(entry.type ?? FILE_TYPE, TYPE_FIELD.start, TYPE_FIELD.length, "ascii");
  header.write("ustar\0", MAGIC_FIELD.start, MAGIC_FIELD.length, "ascii");
  header.write("00", VERSION_FIELD.start, VERSION_FIELD.length, "ascii");
};

const writeChecksum = (header: Buffer): void => {
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  const checksumText = checksum.toString(OCTAL_RADIX).padStart(CHECKSUM_DIGITS, "0");
  header.write(checksumText, CHECKSUM_FIELD.start, CHECKSUM_DIGITS, "ascii");
  header[CHECKSUM_FIELD.start + CHECKSUM_DIGITS] = 0;
  header[CHECKSUM_FIELD.start + CHECKSUM_DIGITS + 1] = CHECKSUM_SPACE;
};

const encodeEntry = (entry: TestTarEntry): Buffer[] => {
  const data = entryData(entry);
  const header = Buffer.alloc(TAR_BLOCK_BYTES);
  writeMetadata(header, entry, data);
  writeFormat(header, entry);
  writeChecksum(header);
  const paddingLength = (TAR_BLOCK_BYTES - (data.length % TAR_BLOCK_BYTES)) % TAR_BLOCK_BYTES;
  return [header, data, Buffer.alloc(paddingLength)];
};

const tarParts = (entries: TestTarEntry[]): Buffer[] => entries.flatMap(encodeEntry);

const tarGzip = (entries: TestTarEntry[]): Buffer => {
  const trailer = Buffer.alloc(TAR_BLOCK_BYTES * TRAILER_BLOCK_COUNT);
  return gzipSync(Buffer.concat([...tarParts(entries), trailer]));
};

const partialTarGzip = (entries: TestTarEntry[]): Buffer => gzipSync(Buffer.concat(tarParts(entries)));

const validReleaseArchive = (version = "v1.0.0"): Buffer => {
  const root = `org-lint-config-${version}`;
  return tarGzip([
    { mode: 0o755, name: `${root}/`, type: "5" },
    { mode: 0o755, name: `${root}/bin/`, type: "5" },
    { data: "#!/bin/sh\necho lint\n", mode: 0o755, name: `${root}/bin/org-lint`, type: "0" },
    { data: "line-length = 120\n", name: `${root}/lint-standards.toml`, type: "0" },
  ]);
};

module.exports = { partialTarGzip, tarGzip, validReleaseArchive };
