import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, buttonVariants } from './button';

// Read off packages/ui/src/base/button.tsx's cva config directly (2026-09-16) —
// not copied from the plan document.
const VARIANTS = ['default', 'destructive', 'ghost', 'link', 'outline', 'secondary'] as const;
const SIZES = ['default', 'icon', 'icon-lg', 'icon-sm', 'icon-xs', 'lg', 'sm', 'xs'] as const;

describe('Button (relocated shadcn primitive)', () => {
  it('resolves every declared variant to a distinct class string', () => {
    const outputs = VARIANTS.map((variant) => buttonVariants({ variant }));
    expect(new Set(outputs).size).toBe(VARIANTS.length);
  });

  it('resolves every declared size to a distinct class string', () => {
    const outputs = SIZES.map((size) => buttonVariants({ size }));
    expect(new Set(outputs).size).toBe(SIZES.length);
  });

  it('produces token-based classes for the variants existing consumers use', () => {
    // Substrings re-confirmed against base/button.tsx immediately before writing this,
    // not copied from the plan.
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-secondary');
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-destructive');
  });

  it("defaults to the file's own defaultVariants when variant/size are omitted", () => {
    expect(buttonVariants({})).toBe(buttonVariants({ variant: 'default', size: 'default' }));
  });

  it('passes through className, type, and arbitrary DOM props', () => {
    const html = renderToStaticMarkup(
      <Button type="submit" className="custom-class" aria-label="Save">
        Save
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('custom-class');
    expect(html).toContain('aria-label="Save"');
  });
});
