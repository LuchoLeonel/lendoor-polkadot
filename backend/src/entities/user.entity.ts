// src/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
} from "typeorm";

export const USER_JOURNEY_STEPS = [
  "verify_identity",
  "use_teleporter",
  "use_timetravel",
  "borrow",
  "repay",
  "supply_liquidity",
  "withdraw_susdc",
  "withdraw_jusdc",
] as const;
export type UserJourneyStep = typeof USER_JOURNEY_STEPS[number];

const lowercase = {
  to: (v?: string | null) => (v == null ? null : v.toLowerCase()),
  from: (v?: string | null) => v ?? null,
};

// decimal <-> number
export const decimalNumber = {
  to: (v?: number | null) => (v == null ? null : v.toString()),
  from: (v: string | null) => (v == null ? null : Number(v)),
};

@Entity({ name: "users" })
@Unique("uq_user_document", ["documentType", "documentNumber"])
@Index("idx_user_wallet", ["walletAddress"], { unique: true })
@Check(`score >= 0 AND score <= 1000`)
@Check(
  `userJourneyStep IN (
    'verify_identity',
    'use_teleporter',
    'use_timetravel',
    'borrow',
    'repay',
    'supply_liquidity',
    'withdraw_susdc',
    'withdraw_jusdc'
  )`,
)
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Wallet address (minúsculas). Único. */
  @Column({ type: "text", transformer: lowercase })
  walletAddress!: string;

  @Column({ type: "text", nullable: true })
  firstName?: string | null;

  @Column({ type: "text", nullable: true })
  lastName?: string | null;

  /** Fecha de nacimiento como texto (ej: "1996-04-12"). */
  @Column({ type: "text", nullable: true })
  birthdate?: string | null;

  /** ISO 3166-1 alpha-2 (AR, US, ...). */
  @Column({ type: "varchar", length: 2, nullable: true })
  nationality?: string | null;

  /** Tipo de documento (DNI, PASSPORT, ...). */
  @Column({ type: "text", nullable: true })
  documentType?: string | null;

  /** Número de documento. */
  @Column({ type: "text", nullable: true })
  documentNumber?: string | null;

  /** Límite de crédito (dinero). */
  @Column({
    type: "decimal",
    precision: 18,
    scale: 2,
    nullable: true,
    default: null,
    transformer: decimalNumber,
  })
  creditLimit?: number | null;

  /** Teleporter: número flexible (float), opcional. */
  @Column({ type: "float", nullable: true, default: null })
  teleporterValue?: number | null;

  /** Timetravel: ENTERO opcional. */
  @Column({ type: "integer", nullable: true, default: null })
  timetravelValue?: number | null;

  /** Score (0–1000). */
  @Column({ type: "integer", nullable: true, default: null })
  score?: number | null;

  /** Paso actual del user journey. */
  @Column({ type: "text", default: "verify_identity" })
  userJourneyStep!: UserJourneyStep;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
