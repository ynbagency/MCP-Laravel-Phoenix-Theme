import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { readFileContent } from '../utils/file-scanner.js';
import { convertPugToBladeHints } from '../utils/pug-to-blade.js';

/**
 * Map a Pug source path (relative to src/pug/) to its compiled HTML path
 * inside the public/ directory.
 */
function pugPathToHtmlPath(pugRelative: string): string {
  return pugRelative.replace(/\.pug$/, '.html');
}

/**
 * Derive a Blade view path from the Pug page path.
 * e.g. "dashboard/crm.pug" → "resources/views/phoenix/dashboard/crm.blade.php"
 *      "apps/crm/analytics.pug" → "resources/views/phoenix/apps/crm/analytics.blade.php"
 */
function suggestBladeViewPath(pugRelative: string): string {
  const bladeRelative = pugRelative.replace(/\.pug$/, '.blade.php');
  return `resources/views/phoenix/${bladeRelative}`;
}

/**
 * Extract variable names used in the Blade template that would need
 * to be provided by a controller.
 */
function extractControllerVariables(hints: ReturnType<typeof convertPugToBladeHints>): string[] {
  const vars = new Set<string>();

  for (const v of hints.variables) {
    vars.add(v);
  }

  // Variables from loops (the collection part)
  for (const loop of hints.loops) {
    const collectionMatch = loop.match(/in\s+(.+)/);
    if (collectionMatch) {
      const collection = collectionMatch[1].trim();
      // Simple variable name
      if (/^\w+$/.test(collection)) {
        vars.add(collection);
      }
    }
  }

  return [...vars];
}

/**
 * Generate a full Blade page view from the conversion hints.
 */
function generateBladePage(
  pugRelative: string,
  hints: ReturnType<typeof convertPugToBladeHints>,
): string {
  const lines: string[] = [];
  const layoutName = hints.layout || 'phoenix-theme';
  const pageTitle = pugRelative
    .replace(/\.pug$/, '')
    .split('/')
    .pop()!
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Props for the page
  const controllerVars = extractControllerVariables(hints);
  if (controllerVars.length > 0) {
    lines.push(`@props([${controllerVars.map((v) => `'${v}'`).join(', ')}])`);
    lines.push('');
  }

  // Layout wrapper
  lines.push(`<x-layouts.${layoutName} title="${pageTitle}">`);

  // Named slots for layout sections
  for (const section of hints.sections) {
    if (section === 'content' || section === 'body') continue; // handled as main slot
    lines.push(`    <x-slot:${section}>`);
    lines.push(`        {{-- ${section} content --}}`);
    lines.push('    </x-slot>');
    lines.push('');
  }

  // Main content area
  lines.push('    <div class="content">');

  // Convert includes to component references
  for (const inc of hints.includes) {
    const componentName = inc
      .replace(/^\.\.\/mixins\//, '')
      .replace(/^\.\.\//, '')
      .replace(/\.pug$/, '')
      .split('/')
      .map((part: string) =>
        part
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase(),
      )
      .join('.');
    lines.push(`        <x-phoenix.${componentName} />`);
  }

  // Convert mixin calls to component tags
  for (const mc of hints.mixinCalls) {
    const componentName = mc.name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
    if (mc.args) {
      lines.push(`        <x-phoenix.${componentName} ${convertArgsToBladePropString(mc.args)} />`);
    } else {
      lines.push(`        <x-phoenix.${componentName} />`);
    }
  }

  // Convert conditionals
  for (const cond of hints.conditionals) {
    lines.push(`        @if(${cond.replace(/\b(\w{3,})\b/g, (m: string) => ['true', 'false', 'null'].includes(m) ? m : `$${m}`)})`);
    lines.push('            {{-- conditional content --}}');
    lines.push('        @endif');
  }

  // Convert loops
  for (const loop of hints.loops) {
    const loopMatch = loop.match(/^(\w+)\s+in\s+(.+)/);
    if (loopMatch) {
      const [, item, collection] = loopMatch;
      lines.push(`        @foreach($${collection} as $${item})`);
      lines.push(`            {{-- loop body for $${item} --}}`);
      lines.push('        @endforeach');
    }
  }

  // If no includes or mixin calls were found, add a placeholder
  if (hints.includes.length === 0 && hints.mixinCalls.length === 0 && hints.conditionals.length === 0 && hints.loops.length === 0) {
    lines.push('        {{-- Page content here --}}');
  }

  lines.push('    </div>');
  lines.push(`</x-layouts.${layoutName}>`);

  return lines.join('\n');
}

/**
 * Convert mixin args string to Blade prop attributes.
 */
function convertArgsToBladePropString(args: string): string {
  const objectMatch = args.match(/^\{([\s\S]*)\}$/);
  if (objectMatch) {
    const pairs = objectMatch[1]
      .split(',')
      .map((p: string) => p.trim())
      .filter(Boolean);
    return pairs
      .map((pair: string) => {
        const [key, ...valueParts] = pair.split(':');
        const value = valueParts.join(':').trim();
        if (!key || !value) return '';
        const k = key.trim();
        if (value.startsWith("'") || value.startsWith('"')) {
          return `${k}=${value.replace(/'/g, '"')}`;
        }
        return `:${k}="${value}"`;
      })
      .filter(Boolean)
      .join(' ');
  }
  return `:data="${args.trim()}"`;
}

export function register(server: McpServer): void {
  server.registerTool(
    'generate_blade_page',
    {
      description:
        'Generate a Laravel Blade page view from a Phoenix Pug page template. ' +
        'Reads the Pug source and compiled HTML, then generates a Blade view that uses ' +
        '<x-layouts.phoenix-theme> and <x-phoenix.*> components. ' +
        'Provide a path relative to src/pug/ (e.g. "dashboard/crm.pug", "apps/crm/analytics.pug").',
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path to the Pug page relative to src/pug/ (e.g. "dashboard/crm.pug", "apps/crm/analytics.pug").',
          ),
      }),
    },
    async (input) => {
      const pugRelative = input.path.replace(/^\/+/, '');
      const pugAbsolute = resolvePath('src/pug', pugRelative);

      // Read Pug source
      let pugSource: string;
      try {
        pugSource = await readFileContent(pugAbsolute);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Error: Could not read Pug file at src/pug/${pugRelative}.\n` +
                'Verify the path is correct (use list_pages to browse available pages).',
            },
          ],
        };
      }

      // Parse Pug → Blade hints
      const hints = convertPugToBladeHints(pugSource);

      // Try to read compiled HTML
      const htmlRelative = pugPathToHtmlPath(pugRelative);
      const htmlAbsolute = resolvePath('public', htmlRelative);
      let htmlContent: string | null = null;
      try {
        htmlContent = await readFileContent(htmlAbsolute);
      } catch {
        // Compiled HTML not available
      }

      // Generate Blade page
      const bladePage = generateBladePage(pugRelative, hints);
      const bladeViewPath = suggestBladeViewPath(pugRelative);
      const controllerVars = extractControllerVariables(hints);

      // Build output sections
      const sections: string[] = [];

      // Original Pug source
      sections.push('## Pug Source');
      sections.push(`File: \`src/pug/${pugRelative}\``);
      sections.push('```pug');
      sections.push(pugSource);
      sections.push('```');
      sections.push('');

      // Compiled HTML (if available)
      if (htmlContent) {
        const truncated =
          htmlContent.length > 5000
            ? htmlContent.slice(0, 5000) + `\n\n... (truncated, ${htmlContent.length} chars total)`
            : htmlContent;
        sections.push('## Compiled HTML');
        sections.push(`File: \`public/${htmlRelative}\``);
        sections.push('```html');
        sections.push(truncated);
        sections.push('```');
        sections.push('');
      } else {
        sections.push(`## Compiled HTML\nNot found at \`public/${htmlRelative}\`.`);
        sections.push('');
      }

      // Generated Blade view
      sections.push('## Generated Blade View');
      sections.push(`File: \`${bladeViewPath}\``);
      sections.push('```blade');
      sections.push(bladePage);
      sections.push('```');
      sections.push('');

      // Blade conversion hints summary
      sections.push('## Conversion Details');
      if (hints.layout) {
        sections.push(`- **Layout:** \`<x-layouts.${hints.layout}>\``);
      }
      if (hints.sections.length > 0) {
        sections.push(`- **Sections:** ${hints.sections.map((s) => `\`${s}\``).join(', ')}`);
      }
      if (hints.includes.length > 0) {
        sections.push(`- **Includes:** ${hints.includes.map((i) => `\`${i}\``).join(', ')}`);
      }
      if (hints.mixinCalls.length > 0) {
        sections.push(
          `- **Component calls:** ${hints.mixinCalls.map((m) => `\`+${m.name}(${m.args})\``).join(', ')}`,
        );
      }
      if (hints.conditionals.length > 0) {
        sections.push(`- **Conditionals:** ${hints.conditionals.map((c) => `\`${c}\``).join(', ')}`);
      }
      if (hints.loops.length > 0) {
        sections.push(`- **Loops:** ${hints.loops.map((l) => `\`${l}\``).join(', ')}`);
      }
      sections.push('');

      // Required controller data
      sections.push('## Required Controller Data');
      if (controllerVars.length > 0) {
        sections.push(
          'The following variables should be passed from your controller\'s `view()` call:',
        );
        sections.push('```php');
        sections.push(`return view('phoenix.${pugRelative.replace(/\.pug$/, '').replace(/\//g, '.')}', [`);
        for (const v of controllerVars) {
          sections.push(`    '${v}' => $${v},`);
        }
        sections.push(']);');
        sections.push('```');
      } else {
        sections.push('No dynamic variables detected. This page may use only static content.');
      }

      // Suggested Blade template from hints (if different from our generation)
      if (hints.bladeTemplate) {
        sections.push('');
        sections.push('## Hints-Based Blade Skeleton (Alternative)');
        sections.push('```blade');
        sections.push(hints.bladeTemplate);
        sections.push('```');
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: sections.join('\n'),
          },
        ],
      };
    },
  );
}
