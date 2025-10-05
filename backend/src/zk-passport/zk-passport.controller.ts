import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ZkPassportService } from './zk-passport.service';
import { SubmitZkPassportDto } from './dto/submit-zk-passport.dto';

@Controller('zkpassport')
export class ZkPassportController {
  constructor(private readonly service: ZkPassportService) {}

  @Post('verify')
  @HttpCode(200)
  async verify(@Body() dto: SubmitZkPassportDto) {
    return this.service.submitAndVerify(dto);
  }
}
