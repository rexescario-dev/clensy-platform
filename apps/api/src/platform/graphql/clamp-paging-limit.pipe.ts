import { Injectable, PipeTransform } from '@nestjs/common';
import { PLATFORM_PAGE_MAX } from './paging';

type PagingBag = { limit?: number; offset?: number };

/** Candidate clamp transform. Task 2 proves whether 9.5.0 runs it before PropertyMax. */
@Injectable()
export class ClampPagingLimitPipe implements PipeTransform {
  transform<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    const paging = (value as { paging?: PagingBag }).paging;
    if (paging === null || typeof paging !== 'object') {
      return value;
    }
    if (typeof paging.limit === 'number' && paging.limit > PLATFORM_PAGE_MAX) {
      paging.limit = PLATFORM_PAGE_MAX;
    }
    return value;
  }
}
