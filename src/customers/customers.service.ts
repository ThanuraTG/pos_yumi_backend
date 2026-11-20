import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CustomerIdService } from './customer-id.service';
import { SelfRegisterCustomerDto } from './dto/self-register.dto';
import {
  Gender,
  RegistrationSource,
  CustomerStatus,
  PhoneVerificationStatus,
  Prisma
} from '@prisma/client';
import { SRI_LANKA_DISTRICTS, SRI_LANKA_LOCATIONS } from './data/sri-lanka-locations';

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerIdService: CustomerIdService
  ) {}

  /**
   * Normalizes phone numbers to standard format (+94XXXXXXXXX)
   */
  normalizePhone(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '+94' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('94')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+94' + cleaned;
      }
    }
    return cleaned;
  }

  /**
   * Calculates age based on birthday
   */
  calculateAge(birthday: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }

  /**
   * Public Customer QR Self-Registration
   * Generates sequential Customer ID (CUS-0001, CUS-0002, ...)
   * Sets status to ACTIVE immediately with NO admin approval required.
   */
  async selfRegister(dto: SelfRegisterCustomerDto) {
    // 1. Anti-spam honeypot verification
    if (dto.website_hp && dto.website_hp.trim().length > 0) {
      this.logger.warn('Honeypot field triggered in self-registration attempt.');
      throw new BadRequestException('Invalid submission request.');
    }

    // 2. Birthday validation (no future dates)
    const birthDate = new Date(dto.birthday);
    if (isNaN(birthDate.getTime())) {
      throw new BadRequestException('Please provide a valid birthday format (YYYY-MM-DD).');
    }
    const today = new Date();
    if (birthDate > today) {
      throw new BadRequestException('Birthday cannot be a future date.');
    }

    // 3. District & City validation
    if (!SRI_LANKA_DISTRICTS.includes(dto.district)) {
      throw new BadRequestException(`Invalid district: ${dto.district}. Must be one of the 25 Sri Lankan districts.`);
    }
    const validCities = SRI_LANKA_LOCATIONS[dto.district] || [];
    if (!validCities.includes(dto.city)) {
      throw new BadRequestException(`City '${dto.city}' does not belong to district '${dto.district}'.`);
    }

    // 4. Family / Emergency contact validation
    const hasFamilyName = Boolean(dto.familyMemberName && dto.familyMemberName.trim());
    const hasFamilyPhone = Boolean(dto.familyMemberPhone && dto.familyMemberPhone.trim());
    if (hasFamilyName !== hasFamilyPhone) {
      throw new BadRequestException(
        'Both family member name and phone number must be provided together if filling emergency contact details.'
      );
    }

    // 5. Mandatory privacy policy consent
    if (!dto.privacyConsent) {
      throw new BadRequestException('You must agree to the Pharmacy Privacy Policy to register.');
    }

    // 6. Normalize primary phone number
    const normalizedPhone = this.normalizePhone(dto.phone);

    // 7. Duplicate phone check across entire customer database
    const existingCustomer = await this.prisma.customer.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: dto.phone }]
      }
    });

    if (existingCustomer) {
      throw new ConflictException(
        `A customer account with phone number ${dto.phone} is already registered. Please visit the pharmacy counter or contact support.`
      );
    }

    // 8. WhatsApp number handling
    let finalWhatsappNumber: string | null = null;
    if (dto.hasWhatsapp) {
      if (dto.whatsappNumber && dto.whatsappNumber.trim()) {
        finalWhatsappNumber = this.normalizePhone(dto.whatsappNumber.trim());
      } else {
        finalWhatsappNumber = normalizedPhone;
      }
    }

    // 9. Atomic Transaction: Generate Customer ID and create Customer record
    return await this.prisma.$transaction(async (tx) => {
      const customerCode = await this.customerIdService.generateNextCustomerCode(tx);

      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: dto.name.trim(),
          birthday: birthDate,
          gender: dto.gender,
          phone: normalizedPhone,
          hasWhatsapp: dto.hasWhatsapp,
          whatsappNumber: finalWhatsappNumber,
          address: dto.address.trim(),
          district: dto.district,
          city: dto.city,
          familyMemberName: dto.familyMemberName?.trim() || null,
          familyMemberPhone: dto.familyMemberPhone ? this.normalizePhone(dto.familyMemberPhone.trim()) : null,
          registrationSource: RegistrationSource.QR_CODE,
          status: CustomerStatus.ACTIVE,
          phoneVerificationStatus: PhoneVerificationStatus.VERIFIED,
          privacyConsent: dto.privacyConsent,
          whatsappConsent: dto.whatsappConsent ?? false,
          medicineReminderConsent: dto.medicineReminderConsent ?? false,
          consentAt: dto.whatsappConsent || dto.medicineReminderConsent ? new Date() : null,
          patients: {
            create: {
              fullName: dto.name.trim(),
              gender: dto.gender !== Gender.PREFER_NOT_TO_SAY ? dto.gender : null,
              age: this.calculateAge(birthDate)
            }
          }
        },
        include: {
          patients: true
        }
      });

      this.logger.log(`New QR Customer registered successfully: ${customerCode} - ${customer.name} (${customer.phone})`);

      return {
        success: true,
        message: 'Customer registered successfully',
        customer: {
          id: customer.id.toString(),
          customerCode: customer.customerCode,
          name: customer.name,
          phone: customer.phone,
          status: customer.status,
          district: customer.district,
          city: customer.city,
          hasWhatsapp: customer.hasWhatsapp,
          whatsappNumber: customer.whatsappNumber,
          createdAt: customer.createdAt
        }
      };
    });
  }

  /**
   * Admin / Cashier Manual Customer Registration
   * Generates sequential Customer ID (CUS-0001, CUS-0002, ...)
   */
  async create(data: {
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
  }) {
    const normalizedPhone = this.normalizePhone(data.phone);

    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [{ phone: normalizedPhone }, { phone: data.phone }]
      }
    });
    if (existing) throw new ConflictException(`Customer with phone ${data.phone} already exists`);

    let finalWhatsappNumber: string | null = null;
    const hasWa = data.hasWhatsapp !== undefined ? data.hasWhatsapp : (data.whatsappConsent ?? true);
    if (hasWa) {
      finalWhatsappNumber = data.whatsappNumber ? this.normalizePhone(data.whatsappNumber) : normalizedPhone;
    }

    const birthDate = data.birthday ? new Date(data.birthday) : null;

    return await this.prisma.$transaction(async (tx) => {
      const customerCode = await this.customerIdService.generateNextCustomerCode(tx);

      return await tx.customer.create({
        data: {
          customerCode,
          name: data.name.trim(),
          phone: normalizedPhone,
          email: data.email?.trim() || null,
          address: data.address?.trim() || null,
          district: data.district || null,
          city: data.city || null,
          birthday: birthDate,
          gender: data.gender || null,
          hasWhatsapp: hasWa,
          whatsappNumber: finalWhatsappNumber,
          familyMemberName: data.familyMemberName?.trim() || null,
          familyMemberPhone: data.familyMemberPhone ? this.normalizePhone(data.familyMemberPhone) : null,
          registrationSource: RegistrationSource.MANUAL,
          status: CustomerStatus.ACTIVE,
          phoneVerificationStatus: PhoneVerificationStatus.VERIFIED,
          privacyConsent: true,
          whatsappConsent: data.whatsappConsent ?? false,
          medicineReminderConsent: data.medicineReminderConsent ?? false,
          consentAt: data.whatsappConsent || data.medicineReminderConsent ? new Date() : null,
          patients: {
            create: {
              fullName: data.name.trim(),
              age: data.age ? Number(data.age) : (birthDate ? this.calculateAge(birthDate) : null),
              gender: data.gender || null,
              knownAllergies: data.allergies?.trim() || null,
              chronicConditions: data.chronicConditions?.trim() || null
            }
          }
        },
        include: {
          patients: true
        }
      });
    });
  }

  /**
   * Find All Customers with advanced search and filters
   */
  async findAll(query?: {
    search?: string;
    source?: string;
    status?: string;
    district?: string;
    city?: string;
  }) {
    const where: any = {};
    const search = query?.search;

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { customerCode: { contains: term } },
        { name: { contains: term } },
        { phone: { contains: term } },
        { email: { contains: term } },
        { address: { contains: term } },
        { district: { contains: term } },
        { city: { contains: term } },
        {
          patients: {
            some: {
              OR: [
                { fullName: { contains: term } },
                { knownAllergies: { contains: term } },
                { chronicConditions: { contains: term } }
              ]
            }
          }
        }
      ];
    }

    if (query?.source && query.source !== 'ALL') {
      where.registrationSource = query.source as RegistrationSource;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as CustomerStatus;
    }

    if (query?.district && query.district !== 'ALL') {
      where.district = query.district;
    }

    if (query?.city && query.city !== 'ALL') {
      where.city = query.city;
    }

    return await this.prisma.customer.findMany({
      where,
      include: {
        patients: {
          include: {
            prescriptions: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        sales: {
          select: {
            id: true,
            grandTotal: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      },
      take: 200,
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Find single customer by ID
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: BigInt(id) },
      include: {
        patients: {
          include: { prescriptions: true }
        },
        sales: {
          include: {
            items: {
              include: { medicine: true, batch: true }
            },
            payments: true
          },
          take: 20,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /**
   * Customer purchase & communication history
   */
  async getHistory(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: BigInt(id) },
      include: {
        sales: {
          include: {
            items: {
              include: { medicine: true, batch: true }
            },
            payments: true
          },
          orderBy: { createdAt: 'desc' }
        },
        patients: {
          include: {
            prescriptions: {
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        notificationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  /**
   * Update Customer details
   */
  async update(
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      district?: string;
      city?: string;
      gender?: any;
      birthday?: string;
      hasWhatsapp?: boolean;
      whatsappNumber?: string;
      whatsappConsent?: boolean;
      medicineReminderConsent?: boolean;
      familyMemberName?: string;
      familyMemberPhone?: string;
      status?: CustomerStatus;
    }
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: BigInt(id) } });
    if (!customer) throw new NotFoundException('Customer not found');

    let normalizedPhone = customer.phone;
    if (data.phone && data.phone !== customer.phone) {
      normalizedPhone = this.normalizePhone(data.phone);
      const existing = await this.prisma.customer.findFirst({
        where: {
          phone: normalizedPhone,
          id: { not: BigInt(id) }
        }
      });
      if (existing) throw new ConflictException(`Phone number ${data.phone} is already in use by another customer`);
    }

    let finalWhatsappNumber = customer.whatsappNumber;
    if (data.hasWhatsapp !== undefined) {
      if (data.hasWhatsapp) {
        finalWhatsappNumber = data.whatsappNumber ? this.normalizePhone(data.whatsappNumber) : normalizedPhone;
      } else {
        finalWhatsappNumber = null;
      }
    } else if (data.whatsappNumber !== undefined) {
      finalWhatsappNumber = data.whatsappNumber ? this.normalizePhone(data.whatsappNumber) : null;
    }

    return await this.prisma.customer.update({
      where: { id: BigInt(id) },
      data: {
        name: data.name ?? customer.name,
        phone: normalizedPhone,
        email: data.email !== undefined ? data.email : customer.email,
        address: data.address !== undefined ? data.address : customer.address,
        district: data.district !== undefined ? data.district : customer.district,
        city: data.city !== undefined ? data.city : customer.city,
        gender: data.gender !== undefined ? (data.gender || null) : customer.gender,
        birthday: data.birthday !== undefined ? (data.birthday ? new Date(data.birthday) : null) : customer.birthday,
        hasWhatsapp: data.hasWhatsapp !== undefined ? data.hasWhatsapp : customer.hasWhatsapp,
        whatsappNumber: finalWhatsappNumber,
        familyMemberName: data.familyMemberName !== undefined ? data.familyMemberName : customer.familyMemberName,
        familyMemberPhone: data.familyMemberPhone !== undefined ? (data.familyMemberPhone ? this.normalizePhone(data.familyMemberPhone) : null) : customer.familyMemberPhone,
        status: data.status !== undefined ? data.status : customer.status,
        whatsappConsent: data.whatsappConsent !== undefined ? data.whatsappConsent : customer.whatsappConsent,
        medicineReminderConsent: data.medicineReminderConsent !== undefined ? data.medicineReminderConsent : customer.medicineReminderConsent,
        consentAt: data.whatsappConsent || data.medicineReminderConsent ? new Date() : customer.consentAt
      },
      include: { patients: true }
    });
  }

  /**
   * Toggle Customer Active / Inactive Status
   */
  async toggleStatus(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: BigInt(id) } });
    if (!customer) throw new NotFoundException('Customer not found');

    const nextStatus = customer.status === CustomerStatus.ACTIVE ? CustomerStatus.INACTIVE : CustomerStatus.ACTIVE;

    return await this.prisma.customer.update({
      where: { id: BigInt(id) },
      data: { status: nextStatus },
      include: { patients: true }
    });
  }

  /**
   * Registration Dashboard Summary Stats
   */
  async getRegistrationStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalCustomers, todayRegistrations, qrRegistrations, manualRegistrations, activeCustomers] =
      await Promise.all([
        this.prisma.customer.count(),
        this.prisma.customer.count({
          where: { createdAt: { gte: today } }
        }),
        this.prisma.customer.count({
          where: { registrationSource: RegistrationSource.QR_CODE }
        }),
        this.prisma.customer.count({
          where: { registrationSource: RegistrationSource.MANUAL }
        }),
        this.prisma.customer.count({
          where: { status: CustomerStatus.ACTIVE }
        })
      ]);

    return {
      totalCustomers,
      todayRegistrations,
      qrRegistrations,
      manualRegistrations,
      activeCustomers
    };
  }

  /**
   * Get Sri Lanka 25 Districts and City Dataset
   */
  getDistrictsAndCities() {
    return {
      districts: SRI_LANKA_DISTRICTS,
      locations: SRI_LANKA_LOCATIONS
    };
  }

  /**
   * Settle Credit balance
   */
  async settleCredit(id: string, amount: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: BigInt(id) } });
    if (!customer) throw new NotFoundException('Customer not found');

    const currentBalance = Number(customer.outstandingBalance || 0);
    const newBalance = Math.max(0, currentBalance - Number(amount));

    return await this.prisma.customer.update({
      where: { id: BigInt(id) },
      data: {
        outstandingBalance: newBalance
      }
    });
  }

  async addPatient(
    customerId: string,
    data: { fullName: string; age?: number; gender?: any; knownAllergies?: string; chronicConditions?: string }
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: BigInt(customerId) } });
    if (!customer) throw new NotFoundException('Customer not found');

    return await this.prisma.patient.create({
      data: {
        customerId: customer.id,
        fullName: data.fullName,
        age: data.age ? Number(data.age) : null,
        gender: data.gender || null,
        knownAllergies: data.knownAllergies || null,
        chronicConditions: data.chronicConditions || null
      }
    });
  }

  async updatePatient(
    patientId: string,
    data: { fullName?: string; age?: number; gender?: any; knownAllergies?: string; chronicConditions?: string }
  ) {
    const patient = await this.prisma.patient.findUnique({ where: { id: BigInt(patientId) } });
    if (!patient) throw new NotFoundException('Patient not found');

    return await this.prisma.patient.update({
      where: { id: BigInt(patientId) },
      data: {
        fullName: data.fullName ?? patient.fullName,
        age: data.age !== undefined ? (data.age ? Number(data.age) : null) : patient.age,
        gender: data.gender !== undefined ? data.gender : patient.gender,
        knownAllergies: data.knownAllergies !== undefined ? data.knownAllergies : patient.knownAllergies,
        chronicConditions: data.chronicConditions !== undefined ? data.chronicConditions : patient.chronicConditions
      }
    });
  }

  async deletePatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: BigInt(patientId) } });
    if (!patient) throw new NotFoundException('Patient not found');

    return await this.prisma.patient.delete({
      where: { id: BigInt(patientId) }
    });
  }

  async getPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(patientId) },
      include: {
        customer: {
          include: {
            sales: {
              include: {
                items: {
                  include: { medicine: true, batch: true }
                }
              },
              take: 20,
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        prescriptions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async updateConsent(id: string, consent: boolean) {
    return await this.prisma.customer.update({
      where: { id: BigInt(id) },
      data: {
        whatsappConsent: consent,
        consentAt: consent ? new Date() : null
      }
    });
  }
}
