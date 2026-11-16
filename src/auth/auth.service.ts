import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  private getRefreshTokenExpiryDate(): Date {
    const expirationStr = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
    const match = expirationStr.match(/^(\d+)([dhm])$/);
    const expiresAt = new Date();
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      if (unit === 'd') expiresAt.setDate(expiresAt.getDate() + value);
      else if (unit === 'h') expiresAt.setHours(expiresAt.getHours() + value);
      else if (unit === 'm') expiresAt.setMinutes(expiresAt.getMinutes() + value);
      else expiresAt.setDate(expiresAt.getDate() + 7);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }
    return expiresAt;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.username }],
        deletedAt: null
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials or account deactivated');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Extract unique roles and permissions
    const roles = user.roles.map((r) => r.role.name);
    const permissionsSet = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => {
        permissionsSet.add(rp.permission.code);
      });
    });
    const permissions = Array.from(permissionsSet);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT access token
    const payload = {
      sub: user.id.toString(),
      username: user.username,
      fullName: user.fullName,
      roles,
      permissions
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'default_access_secret',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '12h'
    });

    // Generate refresh token and save hash
    const rawRefreshToken = uuidv4();
    const tokenHash = await argon2.hash(rawRefreshToken);
    const expiresAt = this.getRefreshTokenExpiryDate();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        permissions
      }
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) throw new UnauthorizedException('User not found');

    const roles = user.roles.map((r) => r.role.name);
    const permissionsSet = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => {
        permissionsSet.add(rp.permission.code);
      });
    });

    return {
      id: user.id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roles,
      permissions: Array.from(permissionsSet)
    };
  }

  async refreshTokens(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // Find active non-revoked tokens
    const activeTokens = await this.prisma.refreshToken.findMany({
      where: {
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: {
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    let matchedToken: any = null;
    for (const t of activeTokens) {
      const isMatch = await argon2.verify(t.tokenHash, rawRefreshToken).catch(() => false);
      if (isMatch) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken || !matchedToken.user || !matchedToken.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { isRevoked: true }
    });

    const user = matchedToken.user;
    const roles = user.roles.map((r: any) => r.role.name);
    const permissionsSet = new Set<string>();
    user.roles.forEach((r: any) => {
      r.role.permissions.forEach((rp: any) => {
        permissionsSet.add(rp.permission.code);
      });
    });
    const permissions = Array.from(permissionsSet);

    // Generate new access token
    const payload = {
      sub: user.id.toString(),
      username: user.username,
      fullName: user.fullName,
      roles,
      permissions
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'default_access_secret',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '12h'
    });

    // Rotate new refresh token
    const newRawRefreshToken = uuidv4();
    const tokenHash = await argon2.hash(newRawRefreshToken);
    const expiresAt = this.getRefreshTokenExpiryDate();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        permissions
      }
    };
  }
}

