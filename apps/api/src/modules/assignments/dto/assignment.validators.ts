import { applyDecorators } from '@nestjs/common';
import { IsDateString, IsString, Matches } from 'class-validator';

export const CivilDate = () =>
  applyDecorators(IsDateString({ strict: true }), Matches(/^[1-9]\d{3}-\d{2}-\d{2}$/));

export const ClockTime = () =>
  applyDecorators(IsString(), Matches(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/));
