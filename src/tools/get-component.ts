import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent, FileEntry } from '../utils/file-scanner.js';
import {
  extractScssDescription,
  extractPugDescription,
  componentNameFromFilename,
} from '../utils/component-metadata.js';
import { convertPugToBladeHints, suggestBladeComponentName } from '../utils/pug-to-blade.js';

type ComponentType = 'scss' | 'pug' | 'js';

const DIRS: Record<ComponentType, { path: string; extensions: string[] }> = {
  scss: { path: 'src/scss/theme', extensions: ['.scss'] },
  pug:  { path: 'src/pug/mixins', extensions: ['.pug'] },
  js:   { path: 'src/js/theme',   extensions: ['.js'] },
};

interface MatchedFile extends FileEntry {
  sourceType: ComponentType;
  dirPath: string;
}

async function findMatches(
  name: string,
  typeFilter?: ComponentType,
): Promise<MatchedFile[]> {
  const needle = name.toLowerCase();
  const types: ComponentType[] = typeFilter ? [typeFilter] : ['scss', 'pug', 'js'];
  const matched: MatchedFile[] = [];

  for (const t of types) {
    const cfg = DIRS[t];
    const dir = resolvePath(cfg.path);
    const files = await scanDirectory(dir, cfg.extensions);

    for (const f of files) {
      const haystack = f.name.toLowerCase();
      if (haystack.includes(needle)) {
        matched.push({ ...f, sourceType: t, dirPath: cfg.path });
      }
    }
  }

  return matched;
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_component',
    {
      description:
        'Retrieve the full source code of a Phoenix theme component by name. ' +
        'Performs a case-insensitive substring match across SCSS, Pug, and JS files. ' +
        'For Pug files, also returns Blade conversion hints.',
      inputSchema: z.object({
        name: z.string().describe('Component name to search for (case-insensitive substring match).'),
        type: z
          .enum(['scss', 'pug', 'js'])
          .optional()
          .describe('Limit search to a specific type.'),
      }),
    },
    async (input) => {
      const matches = await findMatches(input.name, input.type);

      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No component found matching "${input.name}"${input.type ? ` (type: ${input.type})` : ''}. Try a broader search term.`,
            },
          ],
        };
      }

      const sections: string[] = [];

      for (const match of matches) {
        const content = await readFileContent(match.absolutePath);
        const friendlyName = componentNameFromFilename(match.name);
        const relPath = `${match.dirPath}/${match.relativePath}`;

        let description: string;
        if (match.sourceType === 'scss') {
          description = extractScssDescription(content);
        } else if (match.sourceType === 'pug') {
          description = extractPugDescription(content);
        } else {
          const m = content.match(/^\/\/\s+(.+)/m);
          description = m ? m[1].trim() : '';
        }

        const header = [
          `=== ${friendlyName} (${match.sourceType.toUpperCase()}) ===`,
          `Path:  ${relPath}`,
          `Blade: <x-${suggestBladeComponentName(match.sourceType === 'pug' ? match.relativePath : match.name)} />`,
          description ? `Desc:  ${description}` : '',
          '',
        ]
          .filter(Boolean)
          .join('\n');

        let body = `--- Source ---\n${content}`;

        // Add Blade conversion hints for Pug files
        if (match.sourceType === 'pug') {
          const hints = convertPugToBladeHints(content);
          const hintLines: string[] = ['\n--- Blade Conversion Hints ---'];

          if (hints.layout) hintLines.push(`Layout:       ${hints.layout}`);
          if (hints.sections.length) hintLines.push(`Sections:     ${hints.sections.join(', ')}`);
          if (hints.includes.length) hintLines.push(`Includes:     ${hints.includes.join(', ')}`);
          if (hints.variables.length) hintLines.push(`Variables:    ${hints.variables.join(', ')}`);
          if (hints.conditionals.length) hintLines.push(`Conditionals: ${hints.conditionals.join(', ')}`);
          if (hints.loops.length) hintLines.push(`Loops:        ${hints.loops.join(', ')}`);
          if (hints.mixinCalls.length) {
            hintLines.push(
              `Mixin Calls:  ${hints.mixinCalls.map((m) => `+${m.name}(${m.args})`).join(', ')}`,
            );
          }
          if (hints.bladeTemplate) {
            hintLines.push('', '--- Suggested Blade Template ---', hints.bladeTemplate);
          }

          body += hintLines.join('\n');
        }

        sections.push(header + body);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Found ${matches.length} match(es) for "${input.name}":\n\n${sections.join('\n\n')}`,
          },
        ],
      };
    },
  );
}
