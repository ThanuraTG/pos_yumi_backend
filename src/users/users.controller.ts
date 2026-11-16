import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  async findAll() {
    return await this.usersService.findAll();
  }

  @Get('roles')
  @RequirePermissions('users.manage')
  async getRoles() {
    return await this.usersService.getRoles();
  }

  @Post()
  @RequirePermissions('users.manage')
  async create(@Body() dto: CreateUserDto) {
    return await this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return await this.usersService.update(id, dto);
  }

  @Patch(':id/toggle')
  @RequirePermissions('users.manage')
  async toggleActive(@Param('id') id: string) {
    return await this.usersService.toggleActive(id);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  async getRoles() {
    return await this.usersService.getRoles();
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('users.manage')
  async getPermissions() {
    return await this.usersService.getPermissions();
  }
}

