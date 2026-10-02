import type { ClensyMessages, DeepPartial } from '@clensy/web';

// Application-owned overrides for the app i18n boundary (single app i18n
// provider spec §4.1). Committed as `{}`: the application has no override
// values. Tests replace this module with vi.mock; nothing selects values at
// runtime, at build time or by environment. Tenant-sourced labels are a
// separate, future spec (§8).
export const APP_I18N_OVERRIDES: DeepPartial<ClensyMessages> = {};
