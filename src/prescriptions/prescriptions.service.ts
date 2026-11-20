import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/create-prescription.dto';
import { PrescriptionStatus, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string, status?: PrescriptionStatus) {
    const where: Prisma.PrescriptionWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { prescriptionCode: { contains: search } },
              { doctorName: { contains: search } },
              { doctorSlmcNo: { contains: search } },
              { clinicalNotes: { contains: search } },
              { patient: { fullName: { contains: search } } },
              { patient: { customer: { phone: { contains: search } } } },
              { patient: { customer: { name: { contains: search } } } }
            ]
          }
        : {})
    };

    const prescriptions = await this.prisma.prescription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          include: {
            customer: true
          }
        },
        sales: {
          take: 5,
          select: {
            id: true,
            invoiceNumber: true,
            grandTotal: true,
            createdAt: true
          }
        }
      }
    });

    return prescriptions.map((p) => ({
      ...p,
      sales: p.sales.map((s) => ({
        ...s,
        grandTotal: Number(s.grandTotal)
      }))
    }));
  }

  async findOne(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) },
      include: {
        patient: {
          include: {
            customer: true
          }
        },
        sales: {
          include: {
            items: true
          }
        }
      }
    });

    if (!prescription) throw new NotFoundException(`Prescription ${id} not found`);

    return prescription;
  }

  async saveScanFile(imageBase64: string, originalFilename?: string): Promise<{ url: string; filename: string }> {
    try {
      if (!imageBase64) {
        throw new BadRequestException('No image data provided');
      }

      // Detect extension from data URL if present
      let ext = 'jpg';
      let rawBase64 = imageBase64;

      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1];
        rawBase64 = matches[2];
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('pdf')) ext = 'pdf';
        else ext = 'jpg';
      } else if (originalFilename) {
        const fileExt = path.extname(originalFilename).replace('.', '').toLowerCase();
        if (['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(fileExt)) {
          ext = fileExt === 'jpeg' ? 'jpg' : fileExt;
        }
      }

      // Root uploads directory
      const uploadsDir = path.resolve(process.cwd(), 'uploads', 'prescriptions');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `rx-scan-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;
      const filePath = path.join(uploadsDir, filename);

      const buffer = Buffer.from(rawBase64, 'base64');
      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/uploads/prescriptions/${filename}`;
      this.logger.log(`Prescription scan saved to ${filePath} (${relativeUrl})`);

      return {
        url: relativeUrl,
        filename
      };
    } catch (err: any) {
      this.logger.error(`Failed to save prescription scan: ${err.message}`);
      throw new BadRequestException(`Failed to save scan file: ${err.message}`);
    }
  }

  async create(dto: CreatePrescriptionDto) {
    let patient: any = null;

    // 1. If patientId is provided (Existing registered customer/patient)
    if (dto.patientId) {
      patient = await this.prisma.patient.findUnique({
        where: { id: BigInt(dto.patientId) },
        include: { customer: true }
      });

      if (!patient) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: BigInt(dto.patientId) },
          include: { patients: true }
        });
        if (customer) {
          if (customer.patients && customer.patients.length > 0) {
            patient = customer.patients[0];
          } else {
            patient = await this.prisma.patient.create({
              data: {
                customerId: customer.id,
                fullName: customer.name
              },
              include: { customer: true }
            });
          }
        }
      }
    }

    // 2. If no patientId or not found, handle Unregistered / Walk-in Customer
    if (!patient) {
      const walkInName = dto.customerName?.trim() || 'Walk-in Customer';
      const walkInPhone = dto.customerPhone?.trim() || `07${Math.floor(10000000 + Math.random() * 90000000)}`;

      // Check if a customer already exists with this phone number
      let customer = await this.prisma.customer.findFirst({
        where: { phone: walkInPhone },
        include: { patients: true }
      });

      if (!customer) {
        // Generate customer code
        const codeSuffix = Math.floor(10000 + Math.random() * 90000);
        const customerCode = `CUST-${codeSuffix}`;

        customer = await this.prisma.customer.create({
          data: {
            customerCode,
            name: walkInName,
            phone: walkInPhone,
            registrationSource: 'MANUAL',
            status: 'ACTIVE'
          },
          include: { patients: true }
        });
      }

      if (customer.patients && customer.patients.length > 0) {
        patient = customer.patients[0];
      } else {
        patient = await this.prisma.patient.create({
          data: {
            customerId: customer.id,
            fullName: walkInName,
            age: dto.patientAge ? Number(dto.patientAge) : undefined,
            gender: dto.patientGender || undefined
          },
          include: { customer: true }
        });
      }
    }

    if (!patient) {
      throw new BadRequestException('Unable to resolve or create customer record for prescription');
    }

    // 3. Format clinical notes & prescribed medicines lines
    let compiledNotes = dto.clinicalNotes?.trim() || '';
    if (dto.prescribedItems && dto.prescribedItems.length > 0) {
      const itemsList = dto.prescribedItems
        .filter((item) => item.medicineName?.trim())
        .map((item, idx) => {
          const parts = [`#${idx + 1} ${item.medicineName.trim()}`];
          if (item.dosage) parts.push(`[${item.dosage.trim()}]`);
          if (item.frequency) parts.push(`• ${item.frequency.trim()}`);
          if (item.duration) parts.push(`• ${item.duration.trim()}`);
          if (item.quantity) parts.push(`• Qty: ${item.quantity}`);
          if (item.instructions) parts.push(`(${item.instructions.trim()})`);
          return parts.join(' ');
        })
        .join('\n');

      if (itemsList) {
        compiledNotes = compiledNotes
          ? `[PRESCRIBED MEDICINES]\n${itemsList}\n\n[CLINICAL NOTES]\n${compiledNotes}`
          : `[PRESCRIBED MEDICINES]\n${itemsList}`;
      }
    }

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prescriptionCode = `RX-${datePrefix}-${randomSuffix}`;

    return await this.prisma.prescription.create({
      data: {
        prescriptionCode,
        patientId: patient.id,
        doctorName: dto.doctorName.trim(),
        doctorSlmcNo: dto.doctorSlmcNo?.trim() || null,
        prescriptionDate: new Date(dto.prescriptionDate),
        imageAttachmentUrl: dto.imageAttachmentUrl || null,
        totalRefills: dto.totalRefills ? Number(dto.totalRefills) : 1,
        dispensedRefills: 0,
        clinicalNotes: compiledNotes || null,
        status: PrescriptionStatus.PENDING_REVIEW
      },
      include: {
        patient: {
          include: {
            customer: true
          }
        }
      }
    });
  }

  async verify(id: string) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) }
    });
    if (!rx) throw new NotFoundException(`Prescription ${id} not found`);

    return await this.prisma.prescription.update({
      where: { id: BigInt(id) },
      data: { status: PrescriptionStatus.VERIFIED }
    });
  }

  async updateStatus(id: string, dto: UpdatePrescriptionStatusDto) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: BigInt(id) }
    });
    if (!rx) throw new NotFoundException(`Prescription ${id} not found`);

    return await this.prisma.prescription.update({
      where: { id: BigInt(id) },
      data: {
        status: dto.status,
        clinicalNotes: dto.notes ? `${rx.clinicalNotes || ''}\n[Status update]: ${dto.notes}` : rx.clinicalNotes
      }
    });
  }
}
