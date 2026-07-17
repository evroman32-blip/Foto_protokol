import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaModule } from './common/services/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { StaffModule } from './modules/staff/staff.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PatientsModule } from './modules/patients/patients.module';
import { CasesModule } from './modules/cases/cases.module';
import { ProtocolsModule } from './modules/protocols/protocols.module';
import { StagesModule } from './modules/stages/stages.module';
import { UploadModule } from './modules/upload/upload.module';
import { MediaModule } from './modules/media/media.module';
import { RadiologyModule } from './modules/radiology/radiology.module';
import { ImplantsModule } from './modules/implants/implants.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiModule } from './modules/ai/ai.module';
import { Stoma1cModule } from './modules/stoma1c/stoma1c.module';
import { AdminModule } from './modules/admin/admin.module';
import { ManagementModule } from './modules/management/management.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './modules/queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    QueueModule,
    HealthModule,
    AuthModule,
    StaffModule,
    BranchesModule,
    PatientsModule,
    CasesModule,
    ProtocolsModule,
    StagesModule,
    UploadModule,
    MediaModule,
    RadiologyModule,
    ImplantsModule,
    EmergencyModule,
    ReportsModule,
    AuditModule,
    AiModule,
    Stoma1cModule,
    AdminModule,
    ManagementModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
