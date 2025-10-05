// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserJourneyModule } from './user-journey/user-journey.module';
import { ZkPassportModule } from './zk-passport/zk-passport.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database.sqlite',
      synchronize: true,
      migrationsRun: true,
      entities: [User],
      logging: ['error', 'warn'],
    }),
    UserJourneyModule,
    ZkPassportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}