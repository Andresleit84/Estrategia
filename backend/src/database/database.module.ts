import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, types } from 'pg';
import { DbService } from './db.service';

const PG_POOL = 'PG_POOL';

// DATE (OID 1082) → string 'YYYY-MM-DD', sin conversión de timezone
types.setTypeParser(1082, (val: string) => val);
// NUMERIC (OID 1700) → float JS
types.setTypeParser(1700, (val: string) => parseFloat(val));

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          max: 10,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          ssl: config.get('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        }),
    },
    DbService,
  ],
  exports: [DbService],
})
export class DatabaseModule {}
