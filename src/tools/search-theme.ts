import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';

const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  pug: ['.pug'],
  scss: ['.scss'],
  js: ['.js'],
  html: ['.html'],
};

interface SearchMatch {
  filePath: string;
  lineNumber: number;
  contextBefore: string | null;
  matchLine: string;
  contextAfter: string | null;
}

export function register(server: McpServer): void {
  server.registerTool(
    'search_theme',
    {
      description:
        'Case-insensitive substring search across Phoenix theme source files (Pug, SCSS, JS, HTML) in the src/ directory. ' +
        'Returns file path, line number, and matching line with 1 line of context above and below.',
      inputSchema: z.object({
        query: z.string().describe('Search string (case-insensitive substring match).'),
        file_types: z
          .array(z.enum(['pug', 'scss', 'js', 'html']))
          .optional()
          .default(['pug', 'scss', 'js', 'html'])
          .describe('File types to search. Defaults to all four: pug, scss, js, html.'),
        max_results: z
          .number()
          .optional()
          .default(20)
          .describe('Maximum number of matching lines to return. Defaults to 20.'),
      }),
    },
    async (input) => {
      const query = input.query.toLowerCase();
      const fileTypes = input.file_types ?? ['pug', 'scss', 'js', 'html'];
      const maxResults = input.max_results ?? 20;

      // Collect all extensions to scan
      const extensions: string[] = [];
      for (const ft of fileTypes) {
        const exts = FILE_TYPE_EXTENSIONS[ft];
        if (exts) {
          extensions.push(...exts);
        }
      }

      const srcDir = resolvePath('src');
      let files = await scanDirectory(srcDir, extensions);

      // If html is requested, also scan public/ directory
      if (fileTypes.includes('html')) {
        const publicDir = resolvePath('public');
        try {
          const htmlFiles = await scanDirectory(publicDir, ['.html']);
          // Adjust relative paths to be prefixed with public/
          const adjusted = htmlFiles.map((f) => ({
            ...f,
            relativePath: `public/${f.relativePath}`,
          }));
          // Replace the src html files + add public ones
          files = [
            ...files.filter((f) => f.extension !== '.html'),
            ...adjusted,
          ];
        } catch {
          // public dir might not exist; continue with src only
        }
      }

      const matches: SearchMatch[] = [];

      for (const file of files) {
        if (matches.length >= maxResults) break;

        let content: string;
        try {
          content = await readFileContent(file.absolutePath);
        } catch {
          continue;
        }

        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxResults) break;

          if (lines[i].toLowerCase().includes(query)) {
            matches.push({
              filePath: file.extension === '.html' && file.relativePath.startsWith('public/')
                ? file.relativePath
                : `src/${file.relativePath}`,
              lineNumber: i + 1,
              contextBefore: i > 0 ? lines[i - 1] : null,
              matchLine: lines[i],
              contextAfter: i < lines.length - 1 ? lines[i + 1] : null,
            });
          }
        }
      }

      if (matches.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No results found for "${input.query}" in [${fileTypes.join(', ')}] files.`,
            },
          ],
        };
      }

      const lines: string[] = [
        `Found ${matches.length} result(s) for "${input.query}"${matches.length >= maxResults ? ` (limited to ${maxResults})` : ''}:`,
        '',
      ];

      for (const m of matches) {
        lines.push(`### ${m.filePath}:${m.lineNumber}`);
        if (m.contextBefore !== null) {
          lines.push(`  ${m.lineNumber - 1} | ${m.contextBefore}`);
        }
        lines.push(`> ${m.lineNumber} | ${m.matchLine}`);
        if (m.contextAfter !== null) {
          lines.push(`  ${m.lineNumber + 1} | ${m.contextAfter}`);
        }
        lines.push('');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
