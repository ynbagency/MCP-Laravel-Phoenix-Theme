import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { readFileContent } from '../utils/file-scanner.js';

const CATEGORIES = [
  'colors',
  'typography',
  'spacing',
  'borders',
  'shadows',
  'breakpoints',
  'components',
  'all',
] as const;
type Category = (typeof CATEGORIES)[number];

interface ThemeVariable {
  name: string;
  value: string;
  category: Category;
  section: string;
  sourceFile: string;
}

/** SCSS variable files to parse, relative to template root. */
const VARIABLE_FILES = [
  'src/scss/theme/_variables.scss',
  'src/scss/theme/_colors.scss',
  'src/scss/theme/_variables-dark.scss',
  'src/scss/_user-variables.scss',
];

/** Section header pattern: //| Section Name */
const SECTION_HEADER_RE = /^\/\/\|\s+(.+)/;

/** Variable pattern: $var-name: value !default; */
const VARIABLE_RE = /^\$([a-zA-Z0-9_-]+)\s*:\s*(.+?)(?:\s*!default)?\s*;/;

/**
 * Map a section name (from SCSS header comments) to a category.
 * Uses case-insensitive keyword matching.
 */
function categorizeSection(sectionName: string): Exclude<Category, 'all'> {
  const lower = sectionName.toLowerCase();

  if (
    lower.includes('color') ||
    lower.includes('colour') ||
    lower.includes('theme-color') ||
    lower.includes('solid')
  ) {
    return 'colors';
  }
  if (
    lower.includes('font') ||
    lower.includes('typography') ||
    lower.includes('type') ||
    lower.includes('heading') ||
    lower.includes('line-height') ||
    lower.includes('letter-spacing')
  ) {
    return 'typography';
  }
  if (lower.includes('spacing') || lower.includes('spacer') || lower.includes('margin') || lower.includes('padding')) {
    return 'spacing';
  }
  if (lower.includes('border') || lower.includes('radious') || lower.includes('radius')) {
    return 'borders';
  }
  if (lower.includes('shadow')) {
    return 'shadows';
  }
  if (lower.includes('breakpoint') || lower.includes('grid breakpoint')) {
    return 'breakpoints';
  }
  return 'components';
}

/**
 * Parse a single SCSS file and extract variables grouped by section headers.
 */
function parseVariableFile(content: string, sourceFile: string): ThemeVariable[] {
  const variables: ThemeVariable[] = [];
  const lines = content.split('\n');

  let currentSection = 'General';
  let currentCategory: Exclude<Category, 'all'> = 'components';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section header
    const headerMatch = trimmed.match(SECTION_HEADER_RE);
    if (headerMatch) {
      currentSection = headerMatch[1].trim();
      currentCategory = categorizeSection(currentSection);
      continue;
    }

    // Check for variable definition
    const varMatch = trimmed.match(VARIABLE_RE);
    if (varMatch) {
      variables.push({
        name: `$${varMatch[1]}`,
        value: varMatch[2].trim(),
        category: currentCategory,
        section: currentSection,
        sourceFile,
      });
    }
  }

  return variables;
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_theme_variables',
    {
      description:
        'Extract SCSS theme variables from the Phoenix theme. ' +
        'Parses _variables.scss, _colors.scss, _variables-dark.scss, and _user-variables.scss. ' +
        'Variables are grouped by category: colors, typography, spacing, borders, shadows, breakpoints, components.',
      inputSchema: z.object({
        category: z
          .enum(CATEGORIES)
          .optional()
          .default('all')
          .describe('Variable category to filter by. Defaults to "all".'),
      }),
    },
    async (input) => {
      const selectedCategory: Category = input.category ?? 'all';

      const allVariables: ThemeVariable[] = [];

      for (const relPath of VARIABLE_FILES) {
        const absPath = resolvePath(relPath);
        let content: string;
        try {
          content = await readFileContent(absPath);
        } catch {
          // File might not exist (e.g. _user-variables.scss could be empty/missing)
          continue;
        }

        const vars = parseVariableFile(content, relPath);
        allVariables.push(...vars);
      }

      // Filter by category if not "all"
      const filtered =
        selectedCategory === 'all'
          ? allVariables
          : allVariables.filter((v) => v.category === selectedCategory);

      if (filtered.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No variables found${selectedCategory !== 'all' ? ` for category "${selectedCategory}"` : ''}.`,
            },
          ],
        };
      }

      // Group by category, then by section
      const grouped: Record<string, Record<string, ThemeVariable[]>> = {};
      for (const v of filtered) {
        if (!grouped[v.category]) grouped[v.category] = {};
        if (!grouped[v.category][v.section]) grouped[v.category][v.section] = [];
        grouped[v.category][v.section].push(v);
      }

      const lines: string[] = [
        `Found ${filtered.length} variable(s)${selectedCategory !== 'all' ? ` in category "${selectedCategory}"` : ' across all categories'}.`,
        '',
      ];

      for (const [category, sections] of Object.entries(grouped)) {
        lines.push(`## ${category.toUpperCase()}`);

        for (const [section, vars] of Object.entries(sections)) {
          lines.push(`### ${section}`);
          for (const v of vars) {
            lines.push(`  ${v.name}: ${v.value}  (${v.sourceFile})`);
          }
          lines.push('');
        }
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
