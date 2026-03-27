import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { readFileContent } from '../utils/file-scanner.js';

export function register(server: McpServer): void {
  server.registerTool(
    'get_html_page',
    {
      description:
        'Read a compiled HTML page from the Phoenix theme public/ directory. ' +
        'Provide a path relative to public/ (e.g. "dashboard/crm.html", "apps/crm/deals.html", "index.html"). ' +
        'Returns the full HTML content.',
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path to the HTML file relative to public/ (e.g. "dashboard/crm.html", "apps/crm/deals.html", "index.html").',
          ),
      }),
    },
    async (input) => {
      const htmlRelative = input.path.replace(/^\/+/, '');
      const htmlAbsolute = resolvePath('public', htmlRelative);

      let htmlContent: string;
      try {
        htmlContent = await readFileContent(htmlAbsolute);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Could not read HTML file at public/${htmlRelative}. Verify the path is correct (use list_html_pages to browse available pages).`,
            },
          ],
        };
      }

      const sections: string[] = [];

      sections.push(`## HTML Page: public/${htmlRelative}`);
      sections.push('```html');
      sections.push(htmlContent);
      sections.push('```');

      return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
    },
  );
}
