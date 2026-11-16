import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-overview')
  async getDashboardOverview(
    @Query('period') period?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getDashboardOverview(period, dateFrom, dateTo);
  }

  @Get('sales')
  @RequirePermissions('reports.view_sales')
  async getSalesReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getSalesReport(dateFrom, dateTo);
  }

  @Get('pnl')
  @RequirePermissions('reports.view_profit')
  async getPnlStatement(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getPnlStatement(dateFrom, dateTo);
  }

  @Get('profit')
  @RequirePermissions('reports.view_profit')
  async getProfitReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getPnlStatement(dateFrom, dateTo);
  }

  @Get('stock')
  @RequirePermissions('reports.view_inventory')
  async getStock() {
    return await this.reportsService.getStockValuation();
  }

  @Get('stock-valuation')
  @RequirePermissions('reports.view_inventory')
  async getStockValuation() {
    return await this.reportsService.getStockValuation();
  }

  @Get('expiry')
  @RequirePermissions('reports.view_inventory')
  async getExpiryReport(@Query('days') days?: string) {
    return await this.reportsService.getExpiryReport(days ? +days : 60);
  }

  @Get('purchases')
  @RequirePermissions('reports.view_inventory')
  async getPurchasesReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getPurchasesReport(dateFrom, dateTo);
  }

  @Get('low-stock')
  @RequirePermissions('reports.view_inventory')
  async getLowStockAlerts() {
    return await this.reportsService.getLowStockAlerts();
  }

  @Get('regulatory/controlled-drugs')
  @RequirePermissions('reports.view_sales')
  async getControlledDrugsRegister(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getControlledDrugsRegister(dateFrom, dateTo);
  }

  @Get('sales-returns')
  @RequirePermissions('reports.view_sales')
  async getSalesReturns(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getSalesReturnsReport(dateFrom, dateTo);
  }

  @Get('purchase-returns')
  @RequirePermissions('reports.view_inventory')
  async getPurchaseReturns(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getPurchaseReturnsReport(dateFrom, dateTo);
  }

  @Get('customers-summary')
  @RequirePermissions('customers.view')
  async getCustomersSummary() {
    return await this.reportsService.getCustomersReport();
  }

  @Get('suppliers-summary')
  @RequirePermissions('reports.view_inventory')
  async getSuppliersSummary() {
    return await this.reportsService.getSuppliersReport();
  }

  @Get('cash-flow')
  @RequirePermissions('reports.view_profit')
  async getCashFlow(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getCashFlowReport(dateFrom, dateTo);
  }

  @Get('payments')
  @RequirePermissions('reports.view_sales')
  async getPayments(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getPaymentMethodsReport(dateFrom, dateTo);
  }

  @Get('staff-performance')
  @RequirePermissions('reports.view_sales')
  async getStaffPerformance(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getStaffPerformanceReport(dateFrom, dateTo);
  }

  @Get('medicine-movement')
  @RequirePermissions('reports.view_inventory')
  async getMedicineMovement(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return await this.reportsService.getMedicineMovementReport(dateFrom, dateTo);
  }
}

