import auth from '../messages/en/auth.json';
import common from '../messages/en/common.json';
import nav from '../messages/en/nav.json';
import validation from '../messages/en/validation.json';

// Internal to the i18n loading boundary — consumed by ./request.ts and by
// this module's own tests. Application components MUST NOT call this to
// read message text directly; use useTranslations()/getTranslations().
// Enforced by the eslint restriction in Task 3.
export function getMessages() {
  return { auth, common, nav, validation };
}
