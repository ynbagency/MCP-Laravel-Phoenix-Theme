import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { TEMPLATE_ROOT, resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';
import {
  extractScssDescription,
  extractPugDescription,
  componentNameFromFilename,
} from '../utils/component-metadata.js';
import { suggestBladeComponentName } from '../utils/pug-to-blade.js';

interface ComponentInfo {
  name: string;
  type: 'scss' | 'pug' | 'js';
  relativePath: string;
  description: string;
  bladeComponentName: string;
}

const DIRS: Record<'scss' | 'pug' | 'js', { path: string; extensions: string[] }> = {
  scss: { path: 'src/scss/theme', extensions: ['.scss'] },
  pug:  { path: 'src/pug/mixins', extensions: ['.pug'] },
  js:   { path: 'src/js/theme',   extensions: ['.js'] },
};

async function gatherComponents(type: 'scss' | 'pug' | 'js'): Promise<ComponentInfo[]> {
  const cfg = DIRS[type];
  const dir = resolvePath(cfg.path);
  const files = await scanDirectory(dir, cfg.extensions);
  const results: ComponentInfo[] = [];

  for (const file of files) {
    const content = await readFileContent(file.absolutePath);
    let description: string;

    if (type === 'scss') {
      description = extractScssDescription(content);
    } else if (type === 'pug') {
      description = extractPugDescription(content);
    } else {
      // JS — grab the first line comment
      const match = content.match(/^\/\/\s+(.+)/m);
      description = match ? match[1].trim() : '';
    }

    const bladeComponentName =
      type === 'pug'
        ? suggestBladeComponentName(file.relativePath)
        : suggestBladeComponentName(file.name);

    results.push({
      name: componentNameFromFilename(file.name),
      type,
      relativePath: `${cfg.path}/${file.relativePath}`,
      description,
      bladeComponentName,
    });
  }

  return results;
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_components',
    {
      description:
        'List all Phoenix theme components (SCSS partials, Pug mixins, and JS modules). ' +
        'Optionally filter by type. Returns name, type, relative path, description, and suggested Blade component name.',
      inputSchema: z.object({
        type: z
          .enum(['scss', 'pug', 'js'])
          .optional()
          .describe('Filter by component type. Omit to list all types.'),
      }),
    },
    async (input) => {
      const types: Array<'scss' | 'pug' | 'js'> = input.type
        ? [input.type]
        : ['scss', 'pug', 'js'];

      const all: ComponentInfo[] = [];
      for (const t of types) {
        const components = await gatherComponents(t);
        all.push(...components);
      }

      const summary = [
        `Found ${all.length} component(s)${input.type ? ` of type "${input.type}"` : ''}.`,
        '',
        ...all.map(
          (c) =>
            `[${c.type.toUpperCase()}] ${c.name}\n` +
            `  Path:  ${c.relativePath}\n` +
            `  Blade: <x-${c.bladeComponentName} />\n` +
            `  Desc:  ${c.description || '(no description)'}`,
        ),
      ].join('\n');

      return { content: [{ type: 'text' as const, text: summary }] };
    },
  );
}
