import { Controller, Get, Param, Patch, Body } from "@nestjs/common";
import { UserJourneyService } from "./user-journey.service";
import { UpdateUserJourneyDto } from "./dto/update-user-journey.dto";

@Controller("user-journey")
export class UserJourneyController {
  constructor(private readonly service: UserJourneyService) {}

  // GET /user-journey/0xabc... → { walletAddress, step }
  @Get(":wallet")
  async getByWallet(@Param("wallet") wallet: string) {
    return this.service.getStepByWallet(wallet);
  }

  // PATCH /user-journey  { walletAddress, step } → { walletAddress, step }
  @Patch()
  async update(@Body() dto: UpdateUserJourneyDto) {
    return this.service.updateStep(dto);
  }
}