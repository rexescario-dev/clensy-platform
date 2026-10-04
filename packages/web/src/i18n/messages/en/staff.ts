// Default `en` messages for the staff console (StaffDataTable,
// CreateStaffForm and the admin page's own copy). This is the ONLY copy of
// these strings' English text; apps/web may layer partial overrides via
// ClensyI18nProvider. Role labels live in the shared `roles` namespace.
export const staff = {
  actions: { disable: 'Disable' },
  columns: { email: 'Email', role: 'Role', status: 'Status' },
  confirmDisable: {
    confirm: 'Disable',
    description: 'This will disable {email}. They will no longer be able to sign in.',
    title: 'Disable this staff account?',
  },
  empty: 'No staff accounts.',
  errors: {
    accountNotFound: 'This account no longer exists. The list has been refreshed.',
    createFailed: 'Unable to create staff account.',
    createForbidden: "You don't have permission to create staff accounts.",
    disableFailed: 'Unable to disable staff account.',
    disableForbidden: "You don't have permission to disable this account.",
    emailInUse: 'An account with this email already exists.',
    invalidInput: 'Check the email and password and try again.',
    lastTenantOwner: "You can't disable the last active Tenant Owner. Add another Tenant Owner first.",
  },
  form: {
    creating: 'Creating…',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    submit: 'Create staff account',
    title: 'Add staff account',
  },
  loadError: 'Unable to load staff accounts.',
  page: {
    loading: 'Loading…',
    newAccount: '+ New Staff Account',
    title: 'Staff Accounts',
  },
  roleGroups: { owner: 'Tenant Owner', staff: 'Staff' },
  roleHint: { TENANT_OWNER: 'Can manage staff accounts for this organization.' },
  status: { active: 'Active', disabled: 'Disabled' },
};
