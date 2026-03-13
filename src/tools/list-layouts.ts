import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';
import { extractPugDescription } from '../utils/component-metadata.js';
import { mapPugLayoutToBlade } from '../utils/pug-to-blade.js';

export function register(server: McpServer): void {
  server.registerTool(
    'list_layouts',
    {
      description:
        'List all Phoenix Pug layout files and their suggested Blade layout component mappings. ' +
        'Returns layout name, file path, description, and the corresponding Blade layout component name.',
      inputSchema: z.object({}),
    },
    async () => {
      const layoutDir = resolvePath('src/pug/layouts');
      const files = await scanDirectory(layoutDir, ['.pug']);

      const layouts: Array<{
        name: string;
        relativePath: string;
        description: string;
        bladeLayout: string;
      }> = [];

      for (const file of files) {
        const content = await readFileContent(file.absolutePath);
        const description = extractPugDescription(content);
        const bladeLayout = mapPugLayoutToBlade(file.name);

        layouts.push({
          name: file.name,
          relativePath: `src/pug/layouts/${file.relativePath}`,
          description,
          bladeLayout,
        });
      }

      const summary = [
        `Found ${layouts.length} layout(s) in src/pug/layouts/:`,
        '',
        ...layouts.map(
          (l) =>
            `${l.name}\n` +
            `  Path:  ${l.relativePath}\n` +
            `  Blade: <x-layouts.${l.bladeLayout}>\n` +
            `  Desc:  ${l.description || '(no description)'}`,
        ),
      ].join('\n');

      return { content: [{ type: 'text' as const, text: summary }] };
    },
  );
}
