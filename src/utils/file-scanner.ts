import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, basename, extname } from 'node:path';

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  name: string;
  extension: string;
}

export async function scanDirectory(
  dir: string,
  extensions?: string[]
): Promise<FileEntry[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files: FileEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    if (extensions && !extensions.includes(ext)) continue;

    const absolutePath = resolve(entry.parentPath ?? entry.path, entry.name);
    files.push({
      relativePath: relative(dir, absolutePath).replace(/\\/g, '/'),
      absolutePath,
      name: basename(entry.name, ext),
      extension: ext,
    });
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function readFileContent(absolutePath: string): Promise<string> {
  return readFile(absolutePath, 'utf-8');
}
