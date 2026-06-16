import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(
    @CurrentUser() user: UserSession,
    @Query('q') q = '',
  ) {
    return this.svc.search(user.organization_id, q);
  }
}
