import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { readFileContent } from '../utils/file-scanner.js';
import { convertPugToBladeHints } from '../utils/pug-to-blade.js';

/**
 * Map a Pug source path (relative to src/pug/) to its compiled HTML path
 * inside the public/ directory.
 *
 * Example: "pages/starter.pug" → "public/pages/starter.html"
 *          "dashboard/crm.pug" → "public/dashboard/crm.html"
 */
function pugPathToHtmlPath(pugRelative: string): string {
  return pugRelative.replace(/\.pug$/, '.html');
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_page',
    {
      description:
        'Read a Pug page template from the Phoenix theme. ' +
        'Provide a path relative to src/pug/ (e.g. "pages/starter.pug" or "dashboard/crm.pug"). ' +
        'Optionally include the compiled HTML from public/. ' +
        'Always returns Blade conversion hints for Laravel porting.',
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path to the Pug file relative to src/pug/ (e.g. "pages/starter.pug", "dashboard/crm.pug", "apps/chat.pug").',
          ),
        include_html: z
          .boolean()
          .optional()
          .default(false)
          .describe('If true, also read and return the compiled HTML from public/.'),
      }),
    },
    async (input) => {
      const pugRelative = input.path.replace(/^\/+/, '');
      const pugAbsolute = resolvePath('src/pug', pugRelative);

      let pugSource: string;
      try {
        pugSource = await readFileContent(pugAbsolute);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Could not read Pug file at src/pug/${pugRelative}. Verify the path is correct (use list_pages to browse available pages).`,
            },
          ],
        };
      }

      // Blade conversion hints
      const hints = convertPugToBladeHints(pugSource);

      const sections: string[] = [];

      // Pug source
      sections.push(`## Pug Source: src/pug/${pugRelative}`);
      sections.push('```pug');
      sections.push(pugSource);
      sections.push('```');
      sections.push('');

      // Blade conversion hints
      sections.push('## Blade Conversion Hints');
      if (hints.layout) {
        sections.push(`- Layout: \`<x-layouts.${hints.layout}>\``);
      }
      if (hints.sections.length > 0) {
        sections.push(`- Sections: ${hints.sections.map((s) => `\`${s}\``).join(', ')}`);
      }
      if (hints.includes.length > 0) {
        sections.push(`- Includes: ${hints.includes.map((i) => `\`${i}\``).join(', ')}`);
      }
      if (hints.variables.length > 0) {
        sections.push(`- Variables: ${hints.variables.map((v) => `\`$${v}\``).join(', ')}`);
      }
      if (hints.mixinCalls.length > 0) {
        sections.push(
          `- Mixin calls: ${hints.mixinCalls.map((m) => `\`+${m.name}(${m.args})\``).join(', ')}`,
        );
      }
      if (hints.conditionals.length > 0) {
        sections.push(
          `- Conditionals: ${hints.conditionals.map((c) => `\`${c}\``).join(', ')}`,
        );
      }
      if (hints.loops.length > 0) {
        sections.push(`- Loops: ${hints.loops.map((l) => `\`${l}\``).join(', ')}`);
      }
      sections.push('');

      // Suggested Blade template
      if (hints.bladeTemplate) {
        sections.push('## Suggested Blade Template Skeleton');
        sections.push('```blade');
        sections.push(hints.bladeTemplate);
        sections.push('```');
        sections.push('');
      }

      // Compiled HTML (optional)
      if (input.include_html) {
        const htmlRelative = pugPathToHtmlPath(pugRelative);
        const htmlAbsolute = resolvePath('public', htmlRelative);

        try {
          const htmlContent = await readFileContent(htmlAbsolute);
          sections.push(`## Compiled HTML: public/${htmlRelative}`);
          sections.push('```html');
          sections.push(htmlContent);
          sections.push('```');
        } catch {
          sections.push(
            `## Compiled HTML\nCould not find compiled HTML at public/${htmlRelative}.`,
          );
        }
      }

      return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
    },
  );
}
