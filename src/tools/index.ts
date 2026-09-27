import type { ExternalTool, ToolCategory, ToolWithCategory, ToolsFilter } from './tools.types';
import { translate as t } from '@/plugins/i18n.plugin';
import { appBaseUrl as base } from '@/utils/base-url';

const modules = import.meta.glob<true, string, ToolWithCategory>(['./*/index.ts', '!./my-ip/index.ts', '!./currency-converter/index.ts', '!./gitignore-generator/index.ts', '!./gitattributes-generator/index.ts', '!./geo-coordinates-converter/index.ts', '!./pomodoro-timer/index.ts', '!./unicode-formatter/index.ts', '!./markdown-editor/index.ts', '!./ip-geo-location/index.ts', '!./dns-query/index.ts', '!./dns-queries/index.ts', '!./dnsbl-checker/index.ts', '!./explainshell/index.ts', '!./online-wiktionary/index.ts', '!./iana-whois-checker/index.ts', '!./short-urls-expander/index.ts', '!./remove-background/index.ts', '!./translator/index.ts', '!./math-ocr/index.ts', '!./ocr-image/index.ts', '!./gif-to-mp4/index.ts', '!./ping/index.ts', '!./dns-tester/index.ts', '!./https-tester/index.ts', '!./dns-propagation-tester/index.ts', '!./url-redirection-checker/index.ts', '!./html-to-pdf/index.ts', '!./docker-image-downloader/index.ts', '!./tcp-udp-port-tester/index.ts', '!./wireguard-config-generator/index.ts', '!./potrace/index.ts', '!./pdf-compressor/index.ts', '!./user-agent-parser/index.ts', '!./objgen-html/index.ts', '!./objgen-json/index.ts', '!./zpool-calculator/index.ts'], { eager: true, import: 'tool' });

// Both config files are optional; fetch them in parallel so app boot waits on at
// most one network round-trip instead of two sequential ones.
const [filterConfig, externalTools] = await Promise.all([
  fetch(`${base}tools-filter.json`)
    .then((response) => (response.ok ? (response.json() as Promise<ToolsFilter>) : ({} as ToolsFilter)))
    .catch(() => ({}) as ToolsFilter),
  fetch(`${base}external-tools.json`)
    .then((response) => (response.ok ? (response.json() as Promise<ExternalTool[]>) : ([] as ExternalTool[])))
    .catch(() => [] as ExternalTool[]),
]);

const allModules: ToolWithCategory[] = Object.values(modules);

// markdown-it (and its dependency tree) is only needed when a deployment actually
// configures external tools, so it stays out of the startup bundle.
if (externalTools.length > 0) {
  const { default: markdownit } = await import('markdown-it');
  allModules.push(
    ...externalTools.map((externalTool) => {
      const html = markdownit().render(
        externalTool.markdownContent ||
          (externalTool.href ? `${t('tools.external-link-goto')} [${externalTool.href}](${externalTool.href})` : ''),
      );
      return {
        icon: defineAsyncComponent(() => import('@vicons/tabler/es/ExternalLink')),
        ...externalTool,
        component: () => import('@/components/ExternalToolContent.vue'),
        externalHTMLContent: html,
      } as ToolWithCategory;
    }),
  );
}

const makeRegExp = (regex: string | undefined) => (regex ? new RegExp(regex, 'i') : null);
const filters = {
  excludeCategoryFilterRegex: makeRegExp(filterConfig.excludeCategoryFilterRegex),
  includeCategoryFilterRegex: makeRegExp(filterConfig.includeCategoryFilterRegex),
  excludeToolsFilterRegex: makeRegExp(filterConfig.excludeToolsFilterRegex),
  includeToolsFilterRegex: makeRegExp(filterConfig.includeToolsFilterRegex),
};

const filteredModules = allModules.filter((tool) => {
  const category = tool.category || 'Development';
  if (filters.includeToolsFilterRegex?.test(tool.path)) {
    return true;
  }
  if (filters.includeCategoryFilterRegex?.test(category)) {
    return true;
  }
  if (filters.excludeToolsFilterRegex?.test(tool.path)) {
    return false;
  }
  if (filters.excludeCategoryFilterRegex?.test(category)) {
    return false;
  }
  return true;
});

export const toolsByCategory = filteredModules.reduce((la, moduleDef) => {
  let found = la.find((l) => l.name === moduleDef.category);
  if (!found) {
    found = {
      name: moduleDef.category,
      components: [],
    };
    la.push(found);
  }
  found.components.push(moduleDef);
  return la;
}, [] as ToolCategory[]);

export const tools = toolsByCategory.flatMap(({ components }) => components);
