import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge, badgeVariants } from './badge';

// Read off packages/ui/src/base/badge.tsx's cva config directly (2026-09-21) —
// not copied from the plan document. The registry's "radix-nova" style
// generated six variants (default, secondary, destructive, outline, ghost,
// link), not the four a vanilla shadcn Badge would have — asserted against
// the actual generated file rather than assumed.
const VARIANTS = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const;

describe('Badge (shadcn-generated primitive)', () => {
  it('resolves every declared variant to a distinct class string', () => {
    const outputs = VARIANTS.map((variant) => badgeVariants({ variant }));
    expect(new Set(outputs).size).toBe(VARIANTS.length);
  });

  it('produces token-based classes for the four status-badge-relevant variants', () => {
    // Substrings re-confirmed against base/badge.tsx immediately before writing this,
    // not copied from the plan.
    expect(badgeVariants({ variant: 'default' })).toContain('bg-primary');
    expect(badgeVariants({ variant: 'secondary' })).toContain('bg-secondary');
    expect(badgeVariants({ variant: 'destructive' })).toContain('bg-destructive');
    expect(badgeVariants({ variant: 'outline' })).toContain('border-border');
  });

  it("defaults to the file's own defaultVariants when variant is omitted", () => {
    expect(badgeVariants({})).toBe(badgeVariants({ variant: 'default' }));
  });

  it("renders the omitted-variant default on the Badge component itself", () => {
    const html = renderToStaticMarkup(<Badge>New</Badge>);
    // Only assert plain-token classes here — bracketed arbitrary-variant
    // classes (e.g. `[&>svg]:...`) get HTML-entity-escaped by
    // renderToStaticMarkup, so they're not useful substrings to match raw.
    expect(html).toContain('bg-primary');
    expect(html).toContain('text-primary-foreground');
  });

  it('passes through className and arbitrary DOM props', () => {
    const html = renderToStaticMarkup(
      <Badge variant="secondary" className="custom-class" aria-label="Status">
        Active
      </Badge>,
    );
    expect(html).toContain('custom-class');
    expect(html).toContain('aria-label="Status"');
  });
});
