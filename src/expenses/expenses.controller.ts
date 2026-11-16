import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, CreateExpenseCategoryDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermissions('reports.view_pnl')
  async findAll(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('categoryId') categoryId?: string
  ) {
    return await this.expensesService.findAll(dateFrom, dateTo, categoryId);
  }

  @Get('categories')
  @RequirePermissions('reports.view_pnl')
  async getCategories() {
    return await this.expensesService.getCategories();
  }

  @Post('categories')
  @RequirePermissions('settings.manage')
  async createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return await this.expensesService.createCategory(dto);
  }

  @Post()
  @RequirePermissions('cash_register.record_drop')
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateExpenseDto
  ) {
    return await this.expensesService.create(userId, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  async delete(@Param('id') id: string) {
    return await this.expensesService.delete(id);
  }
}

