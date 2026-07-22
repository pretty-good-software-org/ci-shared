const TAR_BLOCK_BYTES = 512;
const TRAILER_BLOCK_COUNT = 2;
const TAR_TRAILER_BYTES = TAR_BLOCK_BYTES * TRAILER_BLOCK_COUNT;
const OCTAL_RADIX = 8;
const CHECKSUM_SPACE = 0x20;
const FILE_TYPE = "0";
const DIRECTORY_TYPE = "5";
const NAME_START = 0;
const NAME_END = 100;
const MODE_START = 100;
const MODE_END = 108;
const SIZE_START = 124;
const SIZE_END = 136;
const CHECKSUM_START = 148;
const CHECKSUM_END = 156;
const TYPE_START = 156;
const TYPE_END = 157;
const PREFIX_START = 345;
const PREFIX_END = 500;

interface TarEntry {
  data: Buffer;
  mode: number;
  name: string;
  type: string;
}

interface ParsedEntry {
  entry: TarEntry;
  nextOffset: number;
}

const isZeroBlock = (block: Buffer): boolean => block.every((byte) => byte === 0);

const readString = (field: Buffer): string => {
  const nullIndex = field.indexOf(0);
  if (nullIndex === -1) {
    return field.toString("utf8");
  }
  return field.subarray(0, nullIndex).toString("utf8");
};

const parseOctal = (field: Buffer, label: string): number => {
  const value = readString(field).trim();
  if (!/^[0-7]+$/.test(value)) {
    throw new Error(`extract release archive: invalid tar ${label}`);
  }
  return Number.parseInt(value, OCTAL_RADIX);
};

const verifyHeaderChecksum = (header: Buffer): void => {
  const expected = parseOctal(header.subarray(CHECKSUM_START, CHECKSUM_END), "header checksum");
  const checksumHeader = Buffer.from(header);
  checksumHeader.fill(CHECKSUM_SPACE, CHECKSUM_START, CHECKSUM_END);
  const actual = checksumHeader.reduce((sum, byte) => sum + byte, 0);
  if (actual !== expected) {
    throw new Error("extract release archive: invalid tar header checksum");
  }
};

const entryName = (header: Buffer): string => {
  const name = readString(header.subarray(NAME_START, NAME_END));
  const prefix = readString(header.subarray(PREFIX_START, PREFIX_END));
  if (!prefix) {
    return name;
  }
  return `${prefix}/${name}`;
};

const parseHeader = (header: Buffer): Omit<TarEntry, "data"> & { size: number } => {
  verifyHeaderChecksum(header);
  return {
    mode: parseOctal(header.subarray(MODE_START, MODE_END), "mode"),
    name: entryName(header),
    size: parseOctal(header.subarray(SIZE_START, SIZE_END), "size"),
    type: readString(header.subarray(TYPE_START, TYPE_END)) || FILE_TYPE,
  };
};

const ensureSafeType = (entry: TarEntry): void => {
  if (entry.type !== FILE_TYPE && entry.type !== DIRECTORY_TYPE) {
    throw new Error(`extract release archive: unsupported tar entry type ${JSON.stringify(entry.type)}`);
  }
  if (entry.type === DIRECTORY_TYPE && entry.data.length !== 0) {
    throw new Error("extract release archive: directory entry contains data");
  }
};

const readEntry = (archive: Buffer, offset: number): ParsedEntry => {
  const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
  const parsedHeader = parseHeader(header);
  const dataStart = offset + TAR_BLOCK_BYTES;
  const dataEnd = dataStart + parsedHeader.size;
  if (dataEnd > archive.length) {
    throw new Error("extract release archive: truncated tar entry");
  }
  const entry = { ...parsedHeader, data: archive.subarray(dataStart, dataEnd) };
  ensureSafeType(entry);
  const paddedSize = Math.ceil(parsedHeader.size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
  return { entry, nextOffset: dataStart + paddedSize };
};

const verifyTrailer = (archive: Buffer, offset: number): void => {
  const trailerEnd = offset + TAR_TRAILER_BYTES;
  if (trailerEnd > archive.length || !isZeroBlock(archive.subarray(offset + TAR_BLOCK_BYTES, trailerEnd))) {
    throw new Error("extract release archive: incomplete tar trailer");
  }
  if (!archive.subarray(trailerEnd).every((byte) => byte === 0)) {
    throw new Error("extract release archive: data follows tar trailer");
  }
};

const appendEntry = (archive: Buffer, offset: number, entries: TarEntry[]): number => {
  const parsedEntry = readEntry(archive, offset);
  entries.push(parsedEntry.entry);
  return parsedEntry.nextOffset;
};

const parseTar = (archive: Buffer): TarEntry[] => {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + TAR_BLOCK_BYTES <= archive.length) {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
    if (isZeroBlock(header)) {
      verifyTrailer(archive, offset);
      return entries;
    }
    offset = appendEntry(archive, offset, entries);
  }
  throw new Error("extract release archive: tar trailer is missing");
};

module.exports = { DIRECTORY_TYPE, parseTar };
