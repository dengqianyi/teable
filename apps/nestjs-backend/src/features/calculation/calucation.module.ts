import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ReferenceService } from './reference.service';

@Module({
  imports: [PrismaService],
  providers: [ReferenceService],
})
export class CalculationModule {}
