import type { ReactNode } from 'react';
import { AppShell } from '../../components/app-shell/app-shell';

// The only layout file for the entire `/app/*` tree (Task 5 brief, Step 6).
// Tasks 6-8 add pages under this layout, not new layout files.
//
// `PageHeader` placement: spec §4.2 describes it as living in "the header,"
// but a Next.js layout's `children` slot has no natural mechanism for a
// child page to inject content into a *different* part of this parent
// layout (`Header`, mounted inside `AppShell`) without a context/slot
// abstraction this milestone doesn't need. This plan resolves it visually
// instead: each migrated page renders its own `<PageHeader>` as the first
// element of its own page content, immediately above its `DataTable` —
// visually it reads as "the page's header," even though structurally it's
// inside `{children}` here, not inside the persistent `Header` component.
// `Header` owns only the user menu and the mobile nav toggle. This is a
// plan-level implementation decision, not a spec-level behavior change.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
