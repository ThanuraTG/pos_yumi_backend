import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { SelfRegisterCustomerDto } from './dto/self-register.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Public } from '../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * Public Customer QR Self-Registration endpoint
   * Does NOT require authentication. Immediate ACTIVE status.
   */
  @Public()
  @Post('self-register')
  @HttpCode(HttpStatus.CREATED)
  async selfRegister(@Body() dto: SelfRegisterCustomerDto) {
    return await this.customersService.selfRegister(dto);
  }

  /**
   * Public Sri Lanka 25 Districts & Dependent Cities dataset
   */
  @Public()
  @Get('locations')
  async getLocations() {
    return this.customersService.getDistrictsAndCities();
  }

  /**
   * Registration Analytics Summary Cards
   */
  @Get('stats/summary')
  @RequirePermissions('customers.view')
  async getStatsSummary() {
    return await this.customersService.getRegistrationStats();
  }

  @Get()
  @RequirePermissions('customers.view')
  async findAll(
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
    @Query('district') district?: string,
    @Query('city') city?: string
  ) {
    return await this.customersService.findAll({ search, source, status, district, city });
  }

  @Get('patients/:id')
  @RequirePermissions('customers.view')
  async getPatient(@Param('id') id: string) {
    return await this.customersService.getPatient(id);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  async findOne(@Param('id') id: string) {
    return await this.customersService.findOne(id);
  }

  @Get(':id/history')
  @RequirePermissions('customers.view')
  async getHistory(@Param('id') id: string) {
    return await this.customersService.getHistory(id);
  }

  @Post()
  @RequirePermissions('customers.manage')
  async create(
    @Body()
    body: {
      name: string;
      phone: string;
      email?: string;
      address?: string;
      whatsappConsent?: boolean;
      allergies?: string;
      chronicConditions?: string;
      creditLimit?: number;
      age?: number;
      gender?: any;
      birthday?: string;
      hasWhatsapp?: boolean;
      whatsappNumber?: string;
      district?: string;
      city?: string;
      familyMemberName?: string;
      familyMemberPhone?: string;
      medicineReminderConsent?: boolean;
    }
  ) {
    return await this.customersService.create(body);
  }

  @Patch(':id')
  @RequirePermissions('customers.manage')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      district?: string;
      city?: string;
      hasWhatsapp?: boolean;
      whatsappNumber?: string;
      whatsappConsent?: boolean;
      medicineReminderConsent?: boolean;
      familyMemberName?: string;
      familyMemberPhone?: string;
      status?: any;
    }
  ) {
    return await this.customersService.update(id, body);
  }

  @Patch(':id/status')
  @RequirePermissions('customers.manage')
  async toggleStatus(@Param('id') id: string) {
    return await this.customersService.toggleStatus(id);
  }

  @Post(':id/settle-credit')
  @RequirePermissions('customers.manage')
  async settleCredit(
    @Param('id') id: string,
    @Body() body: { amount: number; paymentMethod?: string; notes?: string }
  ) {
    return await this.customersService.settleCredit(id, body.amount);
  }

  @Post(':id/patients')
  @RequirePermissions('customers.manage')
  async addPatient(
    @Param('id') id: string,
    @Body()
    body: {
      fullName: string;
      age?: number;
      gender?: any;
      knownAllergies?: string;
      chronicConditions?: string;
    }
  ) {
    return await this.customersService.addPatient(id, body);
  }

  @Patch('patients/:patientId')
  @RequirePermissions('customers.manage')
  async updatePatient(
    @Param('patientId') patientId: string,
    @Body()
    body: {
      fullName?: string;
      age?: number;
      gender?: any;
      knownAllergies?: string;
      chronicConditions?: string;
    }
  ) {
    return await this.customersService.updatePatient(patientId, body);
  }

  @Delete('patients/:patientId')
  @RequirePermissions('customers.manage')
  async deletePatient(@Param('patientId') patientId: string) {
    return await this.customersService.deletePatient(patientId);
  }

  @Patch(':id/consent')
  @RequirePermissions('customers.manage')
  async updateConsent(@Param('id') id: string, @Body('consent') consent: boolean) {
    return await this.customersService.updateConsent(id, consent);
  }
}
