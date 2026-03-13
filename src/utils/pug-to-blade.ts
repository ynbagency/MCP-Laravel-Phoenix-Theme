export interface BladeConversionHints {
  layout: string | null;
  sections: string[];
  includes: string[];
  variables: string[];
  conditionals: string[];
  loops: string[];
  mixinCalls: { name: string; args: string }[];
  bladeTemplate: string;
}

export function convertPugToBladeHints(pugSource: string): BladeConversionHints {
  const lines = pugSource.split('\n');
  const hints: BladeConversionHints = {
    layout: null,
    sections: [],
    includes: [],
    variables: [],
    conditionals: [],
    loops: [],
    mixinCalls: [],
    bladeTemplate: '',
  };

  const bladeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // extends → <x-layouts.name>
    const extendsMatch = trimmed.match(/^extends\s+(.+)/);
    if (extendsMatch) {
      const layoutName = extendsMatch[1].replace(/^\.\.\/layouts\//, '').replace(/\.pug$/, '');
      hints.layout = mapPugLayoutToBlade(layoutName);
      bladeLines.push(`<x-layouts.${hints.layout}>`);
      continue;
    }

    // block → @section
    const blockMatch = trimmed.match(/^(?:append\s+|prepend\s+)?block\s+(\w+)/);
    if (blockMatch) {
      hints.sections.push(blockMatch[1]);
      bladeLines.push(`{{-- @section('${blockMatch[1]}') --}}`);
      continue;
    }

    // include → <x-component>
    const includeMatch = trimmed.match(/^include\s+(.+)/);
    if (includeMatch) {
      const path = includeMatch[1].trim();
      hints.includes.push(path);
      const componentName = suggestBladeComponentName(path);
      bladeLines.push(`{{-- <x-${componentName} /> --}}`);
      continue;
    }

    // Pug variables (- var)
    const varMatch = trimmed.match(/^-\s*var\s+(\w+)\s*=/);
    if (varMatch) {
      hints.variables.push(varMatch[1]);
      bladeLines.push(`{{-- $${varMatch[1]} --}}`);
      continue;
    }

    // Conditionals
    if (/^if\s+/.test(trimmed)) {
      const cond = trimmed.replace(/^if\s+/, '');
      hints.conditionals.push(cond);
      bladeLines.push(`@if(${convertPugExprToBlade(cond)})`);
      continue;
    }
    if (/^else if\s+/.test(trimmed)) {
      const cond = trimmed.replace(/^else if\s+/, '');
      bladeLines.push(`@elseif(${convertPugExprToBlade(cond)})`);
      continue;
    }
    if (trimmed === 'else') {
      bladeLines.push('@else');
      continue;
    }
    if (/^unless\s+/.test(trimmed)) {
      const cond = trimmed.replace(/^unless\s+/, '');
      hints.conditionals.push(`unless ${cond}`);
      bladeLines.push(`@unless(${convertPugExprToBlade(cond)})`);
      continue;
    }

    // Loops (each)
    const eachMatch = trimmed.match(/^each\s+(\w+)(?:\s*,\s*(\w+))?\s+in\s+(.+)/);
    if (eachMatch) {
      const [, item, index, collection] = eachMatch;
      hints.loops.push(`${item} in ${collection}`);
      if (index) {
        bladeLines.push(`@foreach(${convertPugExprToBlade(collection)} as $${index} => $${item})`);
      } else {
        bladeLines.push(`@foreach(${convertPugExprToBlade(collection)} as $${item})`);
      }
      continue;
    }

    // Mixin calls (+MixinName(args))
    const mixinMatch = trimmed.match(/^\+(\w+)(?:\(([^)]*)\))?/);
    if (mixinMatch) {
      const [, name, args] = mixinMatch;
      hints.mixinCalls.push({ name, args: args || '' });
      const bladeComponentName = kebabCase(name);
      if (args) {
        const propsStr = convertMixinArgsToBlade(args);
        bladeLines.push(`<x-phoenix.${bladeComponentName} ${propsStr} />`);
      } else {
        bladeLines.push(`<x-phoenix.${bladeComponentName} />`);
      }
      continue;
    }
  }

  if (hints.layout) {
    bladeLines.push(`</x-layouts.${hints.layout}>`);
  }

  hints.bladeTemplate = bladeLines.join('\n');
  return hints;
}

export function suggestBladeComponentName(pugFilePath: string): string {
  const cleaned = pugFilePath
    .replace(/^\.\.\/mixins\//, '')
    .replace(/^mixins\//, '')
    .replace(/\.pug$/, '');

  const parts = cleaned.split('/');
  return parts
    .map(p => kebabCase(p))
    .join('.')
    .replace(/^phoenix\./, 'phoenix.');
}

export function mapPugLayoutToBlade(layoutName: string): string {
  const mapping: Record<string, string> = {
    'Layout': 'phoenix',
    'LayoutTheme': 'phoenix-theme',
    'LayoutCardAuth': 'phoenix-card-auth',
    'LayoutSimpleAuth': 'phoenix-simple-auth',
    'LayoutSplitAuth': 'phoenix-split-auth',
    'LayoutEcommerce': 'phoenix-ecommerce',
    'LayoutEmail': 'phoenix-email',
    'LayoutFileManager': 'phoenix-file-manager',
    'LayoutFlight': 'phoenix-flight',
    'LayoutHotel': 'phoenix-hotel',
    'LayoutShowcase': 'phoenix-showcase',
    'LayoutComponent': 'phoenix-component',
    'LayoutTrip': 'phoenix-trip',
  };
  return mapping[layoutName] || kebabCase(layoutName);
}

function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function convertPugExprToBlade(expr: string): string {
  return expr
    .replace(/\b(\w+)\b/g, (match) => {
      if (['true', 'false', 'null', 'undefined', 'typeof', 'instanceof'].includes(match)) return match;
      if (/^\d+$/.test(match)) return match;
      if (match.length <= 2) return match;
      return `$${match}`;
    });
}

function convertMixinArgsToBlade(args: string): string {
  // Simple case: single object argument like { key: value, ... }
  const objectMatch = args.match(/^\{([\s\S]*)\}$/);
  if (objectMatch) {
    const pairs = objectMatch[1].split(',').map(p => p.trim()).filter(Boolean);
    return pairs
      .map(pair => {
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

  // Simple string/variable args
  return `:data="${args.trim()}"`;
}
