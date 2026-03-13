import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';
import { extractPugDescription } from '../utils/component-metadata.js';
import { convertPugToBladeHints, mapPugLayoutToBlade } from '../utils/pug-to-blade.js';

export function register(server: McpServer): void {
  server.registerTool(
    'get_layout',
    {
      description:
        'Retrieve the full Pug source of a Phoenix layout file along with its included mixins ' +
        'and a Blade conversion guide. Matches by case-insensitive substring (e.g. "Theme" matches "LayoutTheme").',
      inputSchema: z.object({
        name: z
          .string()
          .describe('Layout name or partial name (e.g. "LayoutTheme", "Theme", "Auth").'),
      }),
    },
    async (input) => {
      const layoutDir = resolvePath('src/pug/layouts');
      const files = await scanDirectory(layoutDir, ['.pug']);

      const needle = input.name.toLowerCase();
      const matches = files.filter((f) => f.name.toLowerCase().includes(needle));

      if (matches.length === 0) {
        const available = files.map((f) => f.name).join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text: `No layout found matching "${input.name}". Available layouts: ${available}`,
            },
          ],
        };
      }

      const sections: string[] = [];

      for (const match of matches) {
        const content = await readFileContent(match.absolutePath);
        const description = extractPugDescription(content);
        const bladeLayout = mapPugLayoutToBlade(match.name);
        const hints = convertPugToBladeHints(content);

        // Extract included mixin paths from the source
        const includeRegex = /^\s*include\s+(.+)/gm;
        const includes: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = includeRegex.exec(content)) !== null) {
          includes.push(m[1].trim());
        }

        const header = [
          `=== ${match.name} ===`,
          `Path:        src/pug/layouts/${match.relativePath}`,
          `Blade:       <x-layouts.${bladeLayout}>`,
          description ? `Description: ${description}` : '',
          '',
        ]
          .filter(Boolean)
          .join('\n');

        const source = `--- Pug Source ---\n${content}`;

        const mixinSection =
          includes.length > 0
            ? `\n\n--- Included Mixins (${includes.length}) ---\n${includes.map((inc) => `  ${inc}`).join('\n')}`
            : '\n\n--- Included Mixins ---\n  (none)';

        const bladeGuide: string[] = ['\n\n--- Blade Conversion Guide ---'];
        bladeGuide.push(`Target Layout Component: <x-layouts.${bladeLayout}>`);

        if (hints.sections.length) {
          bladeGuide.push(`\nSections to define as @section/@yield:`);
          for (const s of hints.sections) {
            bladeGuide.push(`  - @yield('${s}')`);
          }
        }

        if (hints.variables.length) {
          bladeGuide.push(`\nVariables to pass as component props:`);
          for (const v of hints.variables) {
            bladeGuide.push(`  - $${v}`);
          }
        }

        if (hints.mixinCalls.length) {
          bladeGuide.push(`\nMixin calls to convert to Blade components:`);
          for (const mc of hints.mixinCalls) {
            bladeGuide.push(
              `  +${mc.name}(${mc.args}) -> <x-phoenix.${kebabCase(mc.name)}${mc.args ? ' ...' : ''} />`,
            );
          }
        }

        if (hints.conditionals.length) {
          bladeGuide.push(`\nConditionals to convert:`);
          for (const c of hints.conditionals) {
            bladeGuide.push(`  - ${c} -> @if(...)`);
          }
        }

        if (hints.loops.length) {
          bladeGuide.push(`\nLoops to convert:`);
          for (const l of hints.loops) {
            bladeGuide.push(`  - ${l} -> @foreach(...)`);
          }
        }

        if (hints.bladeTemplate) {
          bladeGuide.push('', '--- Suggested Blade Skeleton ---', hints.bladeTemplate);
        }

        sections.push(header + source + mixinSection + bladeGuide.join('\n'));
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: sections.join('\n\n' + '='.repeat(60) + '\n\n'),
          },
        ],
      };
    },
  );
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
