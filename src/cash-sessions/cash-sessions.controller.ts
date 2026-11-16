import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { CashSessionsService } from './cash-sessions.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Post('open')
  @RequirePermissions('cash_register.open_close')
  async openSession(
    @CurrentUser('sub') userId: string,
    @Body() dto: OpenSessionDto
  ) {
    return await this.cashSessionsService.openSession(userId, dto);
  }

  @Get('active')
  @RequirePermissions('cash_register.open_close')
  async getActiveSession(@CurrentUser('sub') userId: string) {
    return await this.cashSessionsService.getActiveSession(userId);
  }

  @Post('drop')
  @RequirePermissions('cash_register.open_close')
  async recordCashDrop(
    @CurrentUser('sub') userId: string,
    @Body() body: { amount: number; notes?: string }
  ) {
    return await this.cashSessionsService.recordCashDrop(userId, Number(body.amount), body.notes);
  }

  @Post('close')
  @RequirePermissions('cash_register.open_close')
  async closeSession(
    @CurrentUser('sub') userId: string,
    @Body() dto: CloseSessionDto
  ) {
    return await this.cashSessionsService.closeSession(userId, dto);
  }

  @Get()
  @RequirePermissions('cash_register.open_close')
  async findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return await this.cashSessionsService.findAll(+page, +limit);
  }
}

