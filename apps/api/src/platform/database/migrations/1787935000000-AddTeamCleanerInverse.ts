import { MigrationInterface } from 'typeorm';

// Dual `@Column teamId` + `@ManyToOne` on CleanerEntity plus inverse
// `@OneToMany` on TeamEntity.cleaners is legal on TypeORM 1.1.x.
// Generate is expected to emit unrelated FK noise; those statements were
// omitted — keep `fk_cleaner_team` name, column, and ON DELETE RESTRICT.
export class AddTeamCleanerInverse1787935000000 implements MigrationInterface {
  name = 'AddTeamCleanerInverse1787935000000';

  public async up(): Promise<void> {
    // no schema diff — cleaner team FK name, column, and ON DELETE already match
  }

  public async down(): Promise<void> {
    // no schema diff
  }
}
