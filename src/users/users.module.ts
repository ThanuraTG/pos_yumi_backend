import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController, RolesController, PermissionsController } from './users.controller';

@Module({
  controllers: [UsersController, RolesController, PermissionsController],
  providers: [UsersService],
  exports: [UsersService]
})
export class UsersModule {}

