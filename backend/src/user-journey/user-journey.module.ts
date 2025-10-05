import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserJourneyService } from './user-journey.service';
import { UserJourneyController } from './user-journey.controller';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserJourneyService],
  controllers: [UserJourneyController]
})
export class UserJourneyModule {}
