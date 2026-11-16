import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected successfully via Prisma');
        break;
      } catch (err: any) {
        this.logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
        if (attempt === maxRetries) {
          throw err;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

