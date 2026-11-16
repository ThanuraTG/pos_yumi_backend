import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateExpenseDto, CreateExpenseCategoryDto } from './dto/create-expense.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dateFrom?: string, dateTo?: string, categoryId?: string) {
    const where: Prisma.ExpenseWhereInput = {
      ...(categoryId ? { categoryId: BigInt(categoryId) } : {}),
      ...(dateFrom || dateTo
        ? {
            expenseDate: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {})
            }
          }
        : {})
    };

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      include: {
        category: true,
        creator: {
          select: { id: true, fullName: true, username: true }
        }
      }
    });

    return expenses.map((e) => ({
      ...e,
      amount: Number(e.amount)
    }));
  }

  async getCategories() {
    return await this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true } }
      }
    });
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    return await this.prisma.expenseCategory.upsert({
      where: { name: dto.name },
      update: {},
      create: { name: dto.name }
    });
  }

  async create(userId: string, dto: CreateExpenseDto) {
    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: BigInt(dto.categoryId) }
    });
    if (!category) throw new NotFoundException(`Expense Category ${dto.categoryId} not found`);

    const expense = await this.prisma.expense.create({
      data: {
        categoryId: BigInt(dto.categoryId),
        amount: new Prisma.Decimal(dto.amount),
        description: dto.description,
        expenseDate: new Date(dto.expenseDate),
        voucherAttachmentUrl: dto.voucherAttachmentUrl,
        cashSessionId: dto.cashSessionId ? BigInt(dto.cashSessionId) : null,
        createdBy: BigInt(userId)
      },
      include: {
        category: true
      }
    });

    return {
      ...expense,
      amount: Number(expense.amount)
    };
  }

  async delete(id: string) {
    return await this.prisma.expense.delete({
      where: { id: BigInt(id) }
    });
  }
}

