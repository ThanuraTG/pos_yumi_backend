import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) {
      throw new ForbiddenException('Access denied: User possesses no permission context');
    }

    // Super admin bypass
    if (user.roles && user.roles.includes('SUPER_ADMIN')) {
      return true;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      user.permissions.includes(perm)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied: Required permission [${requiredPermissions.join(', ')}]`
      );
    }

    return true;
  }
}

