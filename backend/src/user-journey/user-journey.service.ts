// user-journey.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UpdateUserJourneyDto } from './dto/update-user-journey.dto';

const DEFAULT_STEP: User['userJourneyStep'] = 'verify_identity';

@Injectable()
export class UserJourneyService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  private normalizeWallet(addr: string) {
    return addr?.trim().toLowerCase();
  }

  private allRequiredPresent(u: Partial<User>): boolean {
    const req = [u.firstName, u.lastName, u.birthdate, u.nationality, u.documentType, u.documentNumber];
    return req.every(v => !!(v && String(v).trim().length > 0));
  }

  /** Devuelve el step actual; si no existe, lo crea. isVerified: SOLO por datos */
  async getStepByWallet(walletAddress: string) {
    const wallet = this.normalizeWallet(walletAddress);

    let user = await this.repo.findOne({ where: { walletAddress: wallet } });
    if (!user) {
      user = this.repo.create({ walletAddress: wallet, userJourneyStep: DEFAULT_STEP });
      await this.repo.save(user);
    }

    const isVerified = this.allRequiredPresent(user);

    return {
      walletAddress: user.walletAddress,
      step: user.userJourneyStep, 
      isVerified,      
      creditLimit: user.creditLimit ?? null,
    };
  }

  async updateStep(dto: UpdateUserJourneyDto) {
    const wallet = this.normalizeWallet(dto.walletAddress);
    let user = await this.repo.findOne({ where: { walletAddress: wallet } });
    if (!user) {
      user = this.repo.create({ walletAddress: wallet, userJourneyStep: dto.step });
    } else {
      user.userJourneyStep = dto.step;
    }
    await this.repo.save(user);
    return { walletAddress: user.walletAddress, step: user.userJourneyStep };
  }

  async getStrict(walletAddress: string) {
    const wallet = this.normalizeWallet(walletAddress);
    const user = await this.repo.findOne({ where: { walletAddress: wallet } });
    if (!user) throw new NotFoundException('User not found');
    return { walletAddress: user.walletAddress, step: user.userJourneyStep };
  }
}
