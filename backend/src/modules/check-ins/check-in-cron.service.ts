import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../../database/db.service';

@Injectable()
export class CheckInCronService {
  private readonly logger = new Logger(CheckInCronService.name);

  constructor(private readonly db: DbService) {}

  @Cron('0 1 * * *', { name: 'stale-krs-at-risk', timeZone: 'America/Lima' })
  async runNightlyJob() {
    this.logger.log('Nightly cron: marking stale KRs AT_RISK');
    try {
      const orgs = await this.db.query<{ id: string }>(
        `SELECT id FROM organizations WHERE deleted_at IS NULL`,
        [],
      );
      for (const org of orgs) {
        await this.db.execute(`CALL sp_mark_stale_krs_at_risk($1)`, [org.id]);
      }
      this.logger.log(`Stale KRs processed for ${orgs.length} organizations`);
    } catch (err) {
      this.logger.error('Nightly cron failed', err);
    }
  }
}
