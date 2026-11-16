import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page = 1, limit = 50, entityType?: string, action?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, fullName: true, username: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.auditLog.count({ where })
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async log(data: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    beforeData?: any;
    afterData?: any;
  }) {
    return await this.prisma.auditLog.create({
      data: {
        userId: data.userId ? BigInt(data.userId) : null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ? BigInt(data.entityId) : null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        beforeData: data.beforeData || null,
        afterData: data.afterData || null
      }
    });
  }
}

