import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSupplierDto, RecordSupplierPaymentDto } from './dto/create-supplier.dto';
import { Prisma, SupplierPayMethod } from '@prisma/client';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search?: string) {
    const where: Prisma.SupplierWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { contactPerson: { contains: search } },
              { phone: { contains: search } }
            ]
          }
        : {})
    };

    const suppliers = await this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { purchases: true }
        }
      }
    });

    return suppliers.map((s) => ({
      ...s,
      creditLimit: Number(s.creditLimit),
      currentBalance: Number(s.currentBalance)
    }));
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: BigInt(id) },
      include: {
        purchases: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        payments: {
          take: 10,
          orderBy: { paidAt: 'desc' }
        }
      }
    });

    if (!supplier) throw new NotFoundException(`Supplier with ID ${id} not found`);

    return {
      ...supplier,
      creditLimit: Number(supplier.creditLimit),
      currentBalance: Number(supplier.currentBalance),
      purchases: supplier.purchases.map((p) => ({
        ...p,
        totalAmount: Number(p.totalAmount)
      })),
      payments: supplier.payments.map((pm) => ({
        ...pm,
        amount: Number(pm.amount)
      }))
    };
  }

  async create(dto: CreateSupplierDto) {
    const supplier = await this.prisma.supplier.create({
      data: {
        name: dto.name,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        paymentTerms: dto.paymentTerms,
        creditLimit: new Prisma.Decimal(dto.creditLimit || 0),
        currentBalance: new Prisma.Decimal(0)
      }
    });

    return {
      ...supplier,
      creditLimit: Number(supplier.creditLimit),
      currentBalance: Number(supplier.currentBalance)
    };
  }

  async update(id: string, dto: Partial<CreateSupplierDto>) {
    const data: Prisma.SupplierUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson;
    if (dto.phone) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.paymentTerms !== undefined) data.paymentTerms = dto.paymentTerms;
    if (dto.creditLimit !== undefined) data.creditLimit = new Prisma.Decimal(dto.creditLimit);

    const supplier = await this.prisma.supplier.update({
      where: { id: BigInt(id) },
      data
    });

    return {
      ...supplier,
      creditLimit: Number(supplier.creditLimit),
      currentBalance: Number(supplier.currentBalance)
    };
  }

  async recordPayment(supplierId: string, userId: string, dto: RecordSupplierPaymentDto) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: BigInt(supplierId) }
    });
    if (!supplier) throw new NotFoundException(`Supplier ${supplierId} not found`);

    const paymentNumber = `SP-${Date.now()}`;

    return await this.prisma.$transaction(async (tx) => {
      const payment = await tx.supplierPayment.create({
        data: {
          paymentNumber,
          supplierId: BigInt(supplierId),
          amount: new Prisma.Decimal(dto.amount),
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference,
          createdBy: BigInt(userId)
        }
      });

      // Deduct paid amount from supplier's outstanding current balance
      const updatedSupplier = await tx.supplier.update({
        where: { id: BigInt(supplierId) },
        data: {
          currentBalance: {
            decrement: new Prisma.Decimal(dto.amount)
          }
        }
      });

      return {
        payment: {
          ...payment,
          amount: Number(payment.amount)
        },
        newBalance: Number(updatedSupplier.currentBalance)
      };
    });
  }
}
