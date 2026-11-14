/**
 * The blocks that do not need a journey: the views that live on their own page,
 * the command line that traces a route (the hosted site never probes), and the
 * list of what the site deliberately cannot do — the privacy contract, stated as
 * a capability list rather than hidden.
 */
import { useI18n } from '../../i18n/context.tsx';
import { routeHref } from '../../lib/route.ts';
import { CliCommands } from '../CliCommands.tsx';
import { Section } from './Section.tsx';

const CLI_COMMANDS = [
  { label: 'Trace one host', command: 'pnpm voyage trace example.org' },
  { label: 'Read a trace you already have', command: 'pnpm voyage read trace.txt' },
  { label: 'Check the local geolocation database', command: 'pnpm voyage data geodb status' },
  { label: 'Explain the journey', command: 'pnpm voyage explain journey.json --year 1987' },
  { label: 'Export for a ticket or a GIS', command: 'pnpm voyage export journey.json --format geojson' },
  { label: 'Serve the four tools to an agent', command: 'pnpm voyage mcp' },
];

const LIMIT_KEYS = [
  'features.limits.probe',
  'features.limits.enrich',
  'features.limits.data',
  'features.limits.agent',
] as const;

export function CatalogueBlocks() {
  const { t } = useI18n();
  return (
    <>
      <Section id="classroom" title={t('features.classroom.title')} text={t('features.classroom.text')}>
        <a className="button" href={routeHref('classroom')} data-testid="feature-open-classroom">
          {t('features.open')}
        </a>
      </Section>

      <Section id="sources" title={t('features.sources.title')} text={t('features.sources.text')}>
        <a className="button" href={routeHref('sources')} data-testid="feature-open-sources">
          {t('features.open')}
        </a>
      </Section>

      <Section id="paste" title={t('features.paste.title')} text={t('features.paste.text')}>
        <a className="button" href={routeHref('gallery')} data-testid="feature-open-paste">
          {t('features.open')}
        </a>
      </Section>

      <Section id="cli" title={t('features.cli.title')} text={t('features.cli.text')}>
        <CliCommands commands={CLI_COMMANDS} note={t('features.cli.note')} />
      </Section>

      <Section id="limits" title={t('features.limits.title')} text={t('features.limits.text')}>
        <ul className="limits-list" data-testid="feature-limits-list">
          {LIMIT_KEYS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
