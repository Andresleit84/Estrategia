import { Injectable } from '@nestjs/common';
import { DbService } from '../../database/db.service';

export interface SearchResult {
  id:       string;
  title:    string;
  subtitle: string;
  type_key: string;
  category: string;
  href:     string;
}

@Injectable()
export class SearchService {
  constructor(private readonly db: DbService) {}

  async search(orgId: string, q: string): Promise<SearchResult[]> {
    const query = q.trim();
    if (query.length < 2) return [];
    return this.db.query<SearchResult>(
      'SELECT * FROM fn_global_search($1, $2, 25)',
      [orgId, query],
    );
  }
}
