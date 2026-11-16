import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePrescriptionDto, UpdatePrescriptionStatusDto } from './dto/create-prescription.dto';
import { PrescriptionStatus, Prisma } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
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
              { patient: { fullName: { contains: search } } }
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

  async create(dto: CreatePrescriptionDto) {
    let patient = await this.prisma.patient.findUnique({
      where: { id: BigInt(dto.patientId) }
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
            }
          });
        }
      }
    }

    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prescriptionCode = `RX-${datePrefix}-${randomSuffix}`;

    return await this.prisma.prescription.create({
      data: {
        prescriptionCode,
        patientId: patient.id,
        doctorName: dto.doctorName,
        doctorSlmcNo: dto.doctorSlmcNo,
        prescriptionDate: new Date(dto.prescriptionDate),
        imageAttachmentUrl: dto.imageAttachmentUrl,
        totalRefills: dto.totalRefills || 1,
        dispensedRefills: 0,
        clinicalNotes: dto.clinicalNotes,
        status: PrescriptionStatus.PENDING_REVIEW
      },
      include: {
        patient: true
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

