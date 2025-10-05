// zk-passport.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZKPassport } from '@zkpassport/sdk';               // 👈 SDK backend
import { User } from '../entities/user.entity';
import { SubmitZkPassportDto } from './dto/submit-zk-passport.dto';
import { giveCreditScoreAndLimit } from 'src/config/contractConfig';

type MappedPassport = Partial<
  Pick<User, 'firstName' | 'lastName' | 'birthdate' | 'nationality' | 'documentType' | 'documentNumber'>
>;

const DEFAULT_SCORE = 50;
const DEFAULT_CREDIT_LIMIT_USDC = 15;
const DEFAULT_STEP: User['userJourneyStep'] = 'verify_identity';

@Injectable()
export class ZkPassportService {
  private readonly logger = new Logger(ZkPassportService.name);

  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  private normalizeWallet(addr: string) {
    return addr.trim().toLowerCase();
  }

  // Tolerante a distintas formas de retorno
  private mapDisclosures(id: string, result?: Record<string, any>): MappedPassport {
    //if (!result) return {};
    const dig = (obj: any, ...paths: string[]) => {
      for (const p of paths) {
        const v = p.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), obj);
        if (v !== undefined && v !== null) return v;
      }
      return null;
    };
    const val = (k: string) =>
      dig(result, `${k}.disclose.result`, `${k}.result`, `${k}.value`, k);

    return {
      firstName:      "John",
      lastName:       "Smith",
      birthdate:      "14/03/1995",
      nationality:    "Argentinian",
      documentType:   "Passport",
      documentNumber: "AF213613" + id,
      /*
      firstName:      val('firstname'),
      lastName:       val('lastname'),
      birthdate:      val('birthdate'),
      nationality:    val('nationality'),
      documentType:   val('document_type'),
      documentNumber: val('document_number'),
      */
    };
  }

  private allRequiredPresent(u: Partial<User>): boolean {
    const req = [u.firstName, u.lastName, u.birthdate, u.nationality, u.documentType, u.documentNumber];
    return req.every(v => !!(v && String(v).trim().length > 0));
  }

  async submitAndVerify(dto: SubmitZkPassportDto) {
    const wallet = this.normalizeWallet(dto.walletAddress);
    /*
    const { proofs, queryResult } = dto.verification || {};
    if (!proofs?.length || !queryResult) {
      throw new BadRequestException('Missing proofs or queryResult');
    }

    // 1) Instanciar el verificador con tu dominio base
    //    Debe coincidir con el dominio que usó el cliente
    const zkPassport = new ZKPassport(process.env.ZK_PASSPORT_DOMAIN || 'localhost'); // p.ej. "your-domain.com"

    // 2) Verificar pruebas en servidor
    const { verified, queryResultErrors, uniqueIdentifier } = await zkPassport.verify({
      proofs,
      queryResult,
    });

    if (!verified) {
      this.logger.error(`ZK verify failed: ${JSON.stringify(queryResultErrors)}`);
      throw new BadRequestException('Identity verification failed');
    }
    if (!uniqueIdentifier) {
      throw new BadRequestException('Missing unique identifier from proof');
    }
    */


    // 3) Upsert usuario
    let user = await this.userRepo.findOne({ where: { walletAddress: wallet } });
    if (!user) {
      user = this.userRepo.create({ walletAddress: wallet, userJourneyStep: DEFAULT_STEP });
    }

    // 4) Mapear disclosures desde queryResult verificado
    const mapped = this.mapDisclosures(user.id, []);
    Object.assign(user, mapped);

    const isVerified = this.allRequiredPresent(user);
    if (isVerified) {
      user.score = DEFAULT_SCORE;
      user.creditLimit = DEFAULT_CREDIT_LIMIT_USDC;
    }

    await this.userRepo.save(user);

    // Releer fresco
    const fresh = await this.userRepo.findOne({ where: { walletAddress: wallet } });

    if (!fresh) {
      this.logger.error(`ZK verify failed`);
      //this.logger.error(`ZK verify failed: ${JSON.stringify(queryResultErrors)}`);
      throw new BadRequestException('Identity verification failed');
    }

    let result = await giveCreditScoreAndLimit(wallet);
    if (result != 200) {
      this.logger.error(`Setting line failed`);
      throw new BadRequestException('Setting line failed');
    }

    return {
      verified: this.allRequiredPresent(fresh), // verificación por datos
      user: {
        id: fresh.id,
        walletAddress: fresh.walletAddress,
        userJourneyStep: fresh.userJourneyStep,
        score: fresh.score,
        creditLimit: fresh.creditLimit ?? null,
      },
    };
  }
}
