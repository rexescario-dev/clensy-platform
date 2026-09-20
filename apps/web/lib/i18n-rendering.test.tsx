import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../i18n/messages';

function SidebarPrimaryLabel() {
  const t = useTranslations('nav');
  return <h1>{t('sidebar.primary')}</h1>;
}

describe('next-intl resolution path', () => {
  it('resolves a real catalog key through NextIntlClientProvider + useTranslations', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={getMessages()}>
        <SidebarPrimaryLabel />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Primary');
  });
});
