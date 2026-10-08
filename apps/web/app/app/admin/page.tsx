'use client';

import {
  useAdminsQuery,
  useCreateAdminMutation,
  useCurrentAdminQuery,
  useDisableAdminMutation,
} from '@clensy/client';
import { Button, ConfirmDialog, FormDialog, PageHeader } from '@clensy/ui';
import {
  CreateStaffForm,
  StaffDataTable,
  useClensyTranslations,
  type CreateStaffFormValues,
  type StaffErrorKey,
  type StaffMember,
} from '@clensy/web';
import { useState } from 'react';
import { disableConfirmDescription, staffMutationErrorKey } from '../../../lib/staff-console';

const EMPTY_FORM: CreateStaffFormValues = { email: '', password: '', role: 'CUSTOMER_SUPPORT' };

// Staff copy (page, table, form, errors) comes from @clensy/web's `staff`
// namespace, as LoginForm owns its copy, resolved through the app i18n
// boundary that app/app/layout.tsx mounts; this route only composes, wires
// GraphQL and routes (multi-tenant spec §4.8).
//
// Spec §4.1 (Admin Foundation): `middleware.ts` only checks that the session
// cookie is present, not that it's still valid. An expired, invalid, or
// disabled-account session is routed to sign-in by the /app layout's
// SessionGuard (session routing spec §4.5), not by this page: a failed or
// missing `currentAdmin` here shows the staff load error. Whether this page
// is shown at all is the /app layout's
// PageVisibilityGate (role-aware typed URLs spec §4.2, §4.5), a UX rule only
// — the API independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
export default function AdminPage() {
  const t = useClensyTranslations('staff');
  const { data, loading, error } = useCurrentAdminQuery({ fetchPolicy: 'network-only' });
  const currentAdmin = data?.currentAdmin;

  if (loading) {
    return <p className="text-sm text-slate-500">{t('page.loading')}</p>;
  }

  if (error || !currentAdmin) {
    // If the session is invalid, the layout's SessionGuard is already
    // redirecting; otherwise this is a plain load failure.
    return (
      <p role="alert" className="text-sm text-red-600">
        {t('loadError')}
      </p>
    );
  }

  return <StaffConsole currentAdminId={currentAdmin.id} />;
}

function StaffConsole({ currentAdminId }: { currentAdminId: string }) {
  const t = useClensyTranslations('staff');
  const { data, loading, error, refetch } = useAdminsQuery({ fetchPolicy: 'network-only' });
  const [createAdmin, { loading: creating }] = useCreateAdminMutation();
  const [disableAdmin, { loading: disabling }] = useDisableAdminMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CreateStaffFormValues>(EMPTY_FORM);
  const [formErrorKey, setFormErrorKey] = useState<StaffErrorKey | undefined>(undefined);

  // `ConfirmDialog` is open whenever `confirmTarget` is set.
  const [confirmTarget, setConfirmTarget] = useState<StaffMember | undefined>(undefined);
  const [disableErrorKey, setDisableErrorKey] = useState<StaffErrorKey | undefined>(undefined);

  function openCreateForm() {
    setFormValues(EMPTY_FORM);
    setFormErrorKey(undefined);
    // Starting a new action drops the previous disable failure's message.
    setDisableErrorKey(undefined);
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
    setFormErrorKey(undefined);
    try {
      await createAdmin({ variables: { createAdminInput: formValues } });
      setFormOpen(false);
      setFormValues(EMPTY_FORM);
      await refetch();
    } catch (createError) {
      // Dialog stays open so the owner can correct the input.
      setFormErrorKey(staffMutationErrorKey('create', createError));
    }
  }

  async function handleConfirmDisable() {
    if (!confirmTarget) return;
    setDisableErrorKey(undefined);
    try {
      await disableAdmin({ variables: { id: confirmTarget.id } });
      await refetch();
    } catch (disableError) {
      // `ConfirmDialog` has no error slot, so the dialog closes and the
      // failure shows inline on the page below it.
      const key = staffMutationErrorKey('disable', disableError);
      setDisableErrorKey(key);
      // The target is no longer available to this operation; refresh the
      // list so the UI reflects the current tenant-scoped state.
      if (key === 'accountNotFound') await refetch();
    } finally {
      setConfirmTarget(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('page.title')}
        actions={
          <Button type="button" onClick={openCreateForm}>
            {t('page.newAccount')}
          </Button>
        }
      />

      <StaffDataTable
        staff={data?.admins ?? []}
        currentAdminId={currentAdminId}
        loading={loading}
        hasError={Boolean(error)}
        disabling={disabling}
        onDisable={(member) => {
          setDisableErrorKey(undefined);
          setConfirmTarget(member);
        }}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t('form.title')}
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? t('form.creating') : t('form.submit')}
        submitting={creating}
      >
        <CreateStaffForm values={formValues} onChange={setFormValues} errorKey={formErrorKey} />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onClose={() => {
          setConfirmTarget(undefined);
          setDisableErrorKey(undefined);
        }}
        onConfirm={handleConfirmDisable}
        title={t('confirmDisable.title')}
        description={confirmTarget ? disableConfirmDescription(t('confirmDisable.description'), confirmTarget.email) : ''}
        confirmLabel={t('confirmDisable.confirm')}
        confirming={disabling}
      />
      {disableErrorKey ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${disableErrorKey}`)}
        </p>
      ) : null}
    </div>
  );
}
