import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const TEMPLATE_ROOT = resolve(__dirname, '..', 'template', 'phoenix-v1.24.0');

export function resolvePath(...segments: string[]): string {
  return resolve(TEMPLATE_ROOT, ...segments);
}
