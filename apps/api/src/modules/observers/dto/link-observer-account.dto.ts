import { Equals, IsString, IsUUID, Matches } from 'class-validator';
import { CodePointLength } from '../../auth/dto/credential.validators.js';

export class LinkObserverAccountDto {
  @IsUUID('7')
  userId!: string;

  // Operator attestation, not cryptographic proof of the account holder's consent.
  @Equals('supervised_administrative')
  verificationMethod!: 'supervised_administrative';

  @IsString()
  @Matches(/\S/u)
  @CodePointLength(1, 500)
  reason!: string;
}
