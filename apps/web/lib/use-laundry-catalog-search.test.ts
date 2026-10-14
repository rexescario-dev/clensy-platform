import { describe, expect, it } from 'vitest';
import { laundryCatalogSearchVariables } from './use-laundry-catalog-search';

const SORTING = [
  { direction: 'ASC', field: 'name' },
  { direction: 'ASC', field: 'id' },
];

describe('laundryCatalogSearchVariables', () => {
  it('browses the active entries with no name filter for an empty text', () => {
    const variables = laundryCatalogSearchVariables('');
    expect(variables).toEqual({ filter: { active: { is: true } }, paging: { limit: 20 }, sorting: SORTING });
    expect(variables.filter).not.toHaveProperty('name');
  });

  it('adds an escaped contains match on the name', () => {
    expect(laundryCatalogSearchVariables('wa_sh%').filter).toEqual({
      active: { is: true },
      name: { iLike: '%wa\\_sh\\%%' },
    });
  });

  it('does not trim: trimming belongs to the hook', () => {
    expect(laundryCatalogSearchVariables(' wa ').filter.name).toEqual({ iLike: '% wa %' });
  });
});
