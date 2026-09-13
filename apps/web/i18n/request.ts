import { getRequestConfig } from 'next-intl/server';
import { getMessages } from './messages';

export default getRequestConfig(async () => ({
  locale: 'en',
  messages: getMessages(),
}));
