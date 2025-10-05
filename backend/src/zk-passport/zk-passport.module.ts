import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZkPassportService } from './zk-passport.service';
import { ZkPassportController } from './zk-passport.controller';
import { User } from 'src/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [ZkPassportService],
  controllers: [ZkPassportController]
})
export class ZkPassportModule {}
