import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClensyI18nProvider, resolveLocale } from './i18n-context';
import { useClensyTranslations } from './use-clensy-translations';

describe('resolveLocale (pure)', () => {
  it('uses the given locale when one is provided', () => {
    expect(resolveLocale('fr')).toBe('fr');
  });

  it('falls back to "en" when no locale is provided', () => {
    expect(resolveLocale(undefined)).toBe('en');
  });
});

function Probe({ result }: { result: (t: (key: string) => string) => void }) {
  const t = useClensyTranslations('bookings');
  result(t);
  return null;
}

describe('ClensyI18nProvider + useClensyTranslations', () => {
  it('a component receives package defaults with no ClensyI18nProvider in the tree at all', () => {
    let t!: (key: string) => string;
    renderToStaticMarkup(<Probe result={(fn) => (t = fn)} />);
    expect(t('columns.customer')).toBe('Customer');
    expect(t('empty')).toBe('No bookings.');
  });

  it('a component receives package defaults without the host passing "en" explicitly', () => {
    let t!: (key: string) => string;
    renderToStaticMarkup(
      <ClensyI18nProvider>
        <Probe result={(fn) => (t = fn)} />
      </ClensyI18nProvider>,
    );
    expect(t('columns.customer')).toBe('Customer');
  });

  it('a partial override changes only the specified leaf, leaving siblings at package defaults', () => {
    let t!: (key: string) => string;
    renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ bookings: { columns: { customer: 'Client' } } }}>
        <Probe result={(fn) => (t = fn)} />
      </ClensyI18nProvider>,
    );
    expect(t('columns.customer')).toBe('Client');
    expect(t('columns.property')).toBe('Property');
    expect(t('columns.service')).toBe('Service');
    expect(t('columns.scheduled')).toBe('Scheduled');
    expect(t('columns.status')).toBe('Status');
    expect(t('columns.team')).toBe('Team');
    expect(t('columns.price')).toBe('Price');
  });
});
