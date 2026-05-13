import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER } from '@nestjs/core'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AppExceptionFilter } from './common/filters/app-exception.filter'
import { DataSourceModule } from './modules/data-source/data-source.module'
import { ReportModule } from './modules/report/report.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    DataSourceModule,
    ReportModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
  ],
})
export class AppModule {}
