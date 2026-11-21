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

    // Auto-verify and self-heal tables & initial seed on startup
    await this.ensureDatabaseInitialized();
  }

  private async ensureDatabaseInitialized() {
    try {
      // 1. Check if core tables exist
      let hasUsers = false;
      let hasSettings = false;

      try {
        const tables: any[] = await this.$queryRawUnsafe(`
          SELECT TABLE_NAME FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('users', 'pharmacy_settings')
        `);
        hasUsers = tables.some((t: any) => (t.TABLE_NAME || t.table_name) === 'users');
        hasSettings = tables.some((t: any) => (t.TABLE_NAME || t.table_name) === 'pharmacy_settings');
      } catch (checkErr: any) {
        this.logger.warn(`Could not query information_schema: ${checkErr.message}`);
      }

      // If tables don't exist, run prisma db push automatically
      if (!hasUsers || !hasSettings) {
        this.logger.warn('Core database tables missing! Triggering automatic schema sync (prisma db push)...');
        try {
          const { execSync } = await import('child_process');
          const { join } = await import('path');
          const { existsSync } = await import('fs');

          const candidates = [
            join(process.cwd(), 'prisma/schema.prisma'),
            join(process.cwd(), 'backend/prisma/schema.prisma'),
            join(__dirname, '../../../prisma/schema.prisma'),
            join(__dirname, '../../prisma/schema.prisma'),
            '/app/prisma/schema.prisma'
          ];
          const schemaPath = candidates.find((p) => existsSync(p));
          const schemaFlag = schemaPath ? `--schema="${schemaPath}"` : '';

          execSync(`npx prisma db push ${schemaFlag} --accept-data-loss --skip-generate`, {
            stdio: 'inherit',
            env: process.env
          });
          this.logger.log('Database schema synchronized successfully via auto-sync.');
        } catch (execErr: any) {
          this.logger.error(`Auto-schema push attempt failed: ${execErr.message}`);
        }
      }

      // 2. Ensure default admin user and essential roles exist
      await this.ensureDefaultAdminUser();
    } catch (err: any) {
      this.logger.warn(`Database self-healing notice: ${err.message}`);
    }
  }

  private async ensureDefaultAdminUser() {
    try {
      const userCount = await this.user.count();
      if (userCount === 0) {
        this.logger.log('No users found in database. Initializing default SUPER_ADMIN user and security roles...');
        const argon2 = await import('argon2');

        // Create or find SUPER_ADMIN role
        let adminRole = await this.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
        if (!adminRole) {
          adminRole = await this.role.create({
            data: {
              name: 'SUPER_ADMIN',
              displayName: 'System Administrator',
              description: 'Full administrative access to all system modules'
            }
          });
        }

        // Create Cashier, Pharmacist, Pharmacy Manager roles as well
        const otherRoles = [
          { name: 'PHARMACY_MANAGER', displayName: 'Pharmacy Manager' },
          { name: 'PHARMACIST', displayName: 'Responsible Pharmacist (SLMC)' },
          { name: 'CASHIER', displayName: 'Counter Cashier / POS Operator' },
          { name: 'INVENTORY_OFFICER', displayName: 'Inventory Officer' }
        ];
        for (const r of otherRoles) {
          await this.role.upsert({
            where: { name: r.name },
            update: {},
            create: { name: r.name, displayName: r.displayName }
          });
        }

        // Create Default Administrator
        const defaultUsername = process.env.DEMO_ADMIN_USERNAME || 'admin';
        const defaultPassword = process.env.DEMO_ADMIN_PASSWORD || 'Admin@123456';
        const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pharmasys.lk';
        const passwordHash = await argon2.hash(defaultPassword);

        await this.user.create({
          data: {
            username: defaultUsername,
            email: defaultEmail,
            fullName: 'System Administrator',
            passwordHash,
            isActive: true,
            roles: {
              create: {
                roleId: adminRole.id
              }
            }
          }
        });

        this.logger.log(`Default Administrator initialized! Username: "${defaultUsername}", Password: "${defaultPassword}"`);
      }
    } catch (err: any) {
      this.logger.warn(`Default admin user check notice: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

