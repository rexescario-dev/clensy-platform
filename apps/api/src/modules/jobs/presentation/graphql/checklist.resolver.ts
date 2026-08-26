import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Checklist } from '../../domain/checklist';
import { ChecklistItemType } from './checklist-item.type';
import { ChecklistType } from './checklist.type';
import { JobRelationLoaders } from './job-relation.loaders';
import { toChecklistItemType } from './mappers';

@Resolver(() => ChecklistType)
export class ChecklistResolver {
  constructor(private readonly loaders: JobRelationLoaders) {}

  @ResolveField(() => [ChecklistItemType])
  async items(
    @Parent() checklist: Pick<Checklist, 'id'>,
  ): Promise<ChecklistItemType[]> {
    const items = await this.loaders.itemsLoader.load(checklist.id);
    return items.map(toChecklistItemType);
  }
}
