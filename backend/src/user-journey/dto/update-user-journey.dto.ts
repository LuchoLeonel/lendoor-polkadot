import { IsIn, IsNotEmpty, IsString } from "class-validator";
import { USER_JOURNEY_STEPS, UserJourneyStep } from "../../entities/user.entity";

export class UpdateUserJourneyDto {
  @IsString()
  @IsNotEmpty()
  walletAddress!: string;

  @IsIn(USER_JOURNEY_STEPS as readonly string[])
  step!: UserJourneyStep;
}
