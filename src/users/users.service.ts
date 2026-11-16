import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: {
              select: { id: true, name: true, displayName: true }
            }
          }
        }
      }
    });

    return users.map((u) => ({
      ...u,
      roles: u.roles.map((r) => r.role.name),
      roleDetails: u.roles.map((r) => r.role)
    }));
  }

  async getRoles() {
    return await this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: {
        _count: { select: { users: true } },
        permissions: {
          include: { permission: true }
        }
      }
    });
  }

  async getPermissions() {
    return await this.prisma.permission.findMany({
      orderBy: { module: 'asc' }
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }]
      }
    });
    if (existing) throw new ConflictException('Username or email already exists');

    const passwordHash = await argon2.hash(dto.password);

    // Resolve Role IDs
    const roles = await this.prisma.role.findMany({
      where: { name: { in: dto.roles } }
    });

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        isActive: true,
        roles: {
          create: roles.map((r) => ({
            role: { connect: { id: r.id } }
          }))
        }
      },
      include: {
        roles: {
          include: { role: true }
        }
      }
    });

    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      roles: user.roles.map((r) => r.role.name)
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) }
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return await this.prisma.$transaction(async (tx) => {
      if (dto.roles && dto.roles.length > 0) {
        // Clear existing roles
        await tx.userRole.deleteMany({
          where: { userId: BigInt(id) }
        });

        const newRoles = await tx.role.findMany({
          where: { name: { in: dto.roles } }
        });

        await tx.userRole.createMany({
          data: newRoles.map((r) => ({
            userId: BigInt(id),
            roleId: r.id
          }))
        });
      }

      const updated = await tx.user.update({
        where: { id: BigInt(id) },
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          isActive: dto.isActive
        },
        include: {
          roles: {
            include: { role: true }
          }
        }
      });

      return {
        id: updated.id.toString(),
        username: updated.username,
        email: updated.email,
        fullName: updated.fullName,
        phone: updated.phone,
        isActive: updated.isActive,
        roles: updated.roles.map((r) => r.role.name)
      };
    });
  }

  async toggleActive(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) }
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    return await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: { isActive: !user.isActive }
    });
  }
}

