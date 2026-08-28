# docs

Product and architecture decisions live next to the work they govern.

| Area | Path |
| --- | --- |
| Architecture / product RFCs | [`superpowers/specs/`](superpowers/specs/) |
| Implementation plans | [`superpowers/plans/`](superpowers/plans/) |
| Engineering workflow (M1–M10) | [`workflows/`](workflows/) |

## Paginated GraphQL collections (#33)

Shipped in this slice. Offset connections (default 20 / max 100, clamp), `totalCount` on root Query collections only, nested connections without `totalCount`.

- Spec (Accepted): [2026-08-28-paginated-graphql-collections-design.md](superpowers/specs/2026-08-28-paginated-graphql-collections-design.md)
- Plan (Accepted): [2026-08-28-paginated-graphql-collections-plan.md](superpowers/plans/2026-08-28-paginated-graphql-collections-plan.md)
