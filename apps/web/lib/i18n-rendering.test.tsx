import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../i18n/messages';

function LoginTitle() {
  const t = useTranslations('auth');
  return <h1>{t('title')}</h1>;
}

describe('next-intl resolution path', () => {
  it('resolves a real catalog key through NextIntlClientProvider + useTranslations', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={getMessages()}>
        <LoginTitle />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Clensy Admin Login');
  });
});
