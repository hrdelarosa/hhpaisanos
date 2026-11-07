import { SetMetadata } from '@nestjs/common';

export const PUBLIC = Symbol('auth:public');
export const Public = () => SetMetadata(PUBLIC, true);
