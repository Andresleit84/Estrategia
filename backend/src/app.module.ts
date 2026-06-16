import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisModule } from './common/redis/redis.module';
import { EmailModule } from './common/email/email.module';
import { TelegramModule } from './common/telegram/telegram.module';
import { NotificationsModule } from './common/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TeamsModule } from './modules/teams/teams.module';
import { CyclesModule } from './modules/cycles/cycles.module';
import { ObjectivesModule } from './modules/objectives/objectives.module';
import { KeyResultsModule } from './modules/key-results/key-results.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './common/health/health.module';
import { McpModule } from './mcp/mcp.module';
import { ProblemsModule } from './modules/problems/problems.module';
import { StrategicIntentsModule } from './modules/strategic-intents/strategic-intents.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { InitiativesModule } from './modules/initiatives/initiatives.module';
import { BacklogModule } from './modules/backlog/backlog.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SystemModule } from './modules/system/system.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiDiagnosticModule } from './modules/ai-diagnostic/ai-diagnostic.module';
import { AreasModule } from './modules/areas/areas.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { SearchModule } from './modules/search/search.module';
import { BillingModule } from './modules/billing/billing.module';
import { SupportModule } from './modules/support/support.module';
import { SectorAssessmentModule } from './modules/sector-assessment/sector-assessment.module';
import { TransformationProgramModule } from './modules/transformation-program/transformation-program.module';
import { DemoModule } from './modules/demo/demo.module';
import { ImportModule } from './modules/import/import.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { ConsultantModule } from './modules/consultant/consultant.module';
import { InternalModule } from './modules/internal/internal.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { OrgContextInterceptor } from './common/interceptors/org-context.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE ?? '../.env',
    }),
    ScheduleModule.forRoot(),
    RedisModule,
    EmailModule,
    TelegramModule,
    NotificationsModule,
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 10  },
      { name: 'medium', ttl: 10000, limit: 50  },
      { name: 'long',   ttl: 60000, limit: 200 },
    ]),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    CyclesModule,
    ObjectivesModule,
    KeyResultsModule,
    AiModule,
    HealthModule,
    McpModule,
    ProblemsModule,
    StrategicIntentsModule,
    CheckInsModule,
    InitiativesModule,
    BacklogModule,
    SprintsModule,
    ReportsModule,
    SystemModule,
    AdminModule,
    UsersModule,
    AiDiagnosticModule,
    AreasModule,
    GovernanceModule,
    DeliveryModule,
    SearchModule,
    BillingModule,
    SupportModule,
    SectorAssessmentModule,
    TransformationProgramModule,
    DemoModule,
    ImportModule,
    AgreementsModule,
    ConsultantModule,
    InternalModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: OrgContextInterceptor },
  ],
})
export class AppModule {}
