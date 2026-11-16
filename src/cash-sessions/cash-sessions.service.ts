import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { SessionStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async openSession(userId: string, dto: OpenSessionDto) {
    const userBigInt = BigInt(userId);

    // Check if cashier already has an open session; if so, return it idempotently
    const existing = await this.prisma.cashSession.findFirst({
      where: { userId: userBigInt, status: SessionStatus.OPEN },
      include: {
        user: { select: { fullName: true, username: true } }
      }
    });
    if (existing) {
      return existing;
    }

    return await this.prisma.cashSession.create({
      data: {
        userId: userBigInt,
        openingFloat: dto.openingFloat,
        status: SessionStatus.OPEN
      },
      include: {
        user: { select: { fullName: true, username: true } }
      }
    });
  }

  async getActiveSession(userId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { userId: BigInt(userId), status: SessionStatus.OPEN },
      include: {
        user: { select: { fullName: true, username: true } },
        expenses: {
          select: { id: true, amount: true, description: true, createdAt: true }
        }
      }
    });
    if (!session) return null;

    // Calculate current expected cash on hand
    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        sale: { cashSessionId: session.id },
        paymentMethod: PaymentMethod.CASH,
        status: 'SUCCESS'
      },
      _sum: { amount: true }
    });
    const totalCashSales = Number(cashPayments._sum.amount || 0);

    const cashRefunds = await this.prisma.salesReturn.aggregate({
      where: {
        sale: { cashSessionId: session.id },
        refundMethod: 'CASH'
      },
      _sum: { refundTotal: true }
    });
    const totalCashRefunds = Number(cashRefunds._sum.refundTotal || 0);

    const expensesSum = await this.prisma.expense.aggregate({
      where: { cashSessionId: session.id },
      _sum: { amount: true }
    });
    const totalExpenses = Number(expensesSum._sum.amount || 0);

    const currentDrawerCash = Number(session.openingFloat) + totalCashSales - totalCashRefunds - totalExpenses;

    return {
      ...session,
      currentDrawerCash,
      totalCashSales,
      totalCashRefunds,
      totalExpenses
    };
  }

  async recordCashDrop(userId: string, amount: number, notes?: string) {
    const userBigInt = BigInt(userId);

    const session = await this.prisma.cashSession.findFirst({
      where: { userId: userBigInt, status: SessionStatus.OPEN }
    });
    if (!session) {
      throw new NotFoundException('No active open cash session found.');
    }

    // Ensure category exists
    let category = await this.prisma.expenseCategory.findUnique({
      where: { name: 'CASH_DROP' }
    });
    if (!category) {
      category = await this.prisma.expenseCategory.create({
        data: { name: 'CASH_DROP' }
      });
    }

    const dropExpense = await this.prisma.expense.create({
      data: {
        categoryId: category.id,
        cashSessionId: session.id,
        amount: amount,
        description: `Mid-day Cash Drop (Transfer to Safe): ${notes || 'Standard Drop'}`,
        createdBy: userBigInt,
        expenseDate: new Date()
      }
    });

    const currency = process.env.DEFAULT_CURRENCY || 'LKR';
    return {
      success: true,
      message: `Cash drop of ${currency} ${amount.toFixed(2)} recorded successfully.`,
      expense: dropExpense
    };
  }

  async closeSession(userId: string, dto: CloseSessionDto) {
    const userBigInt = BigInt(userId);

    const session = await this.prisma.cashSession.findFirst({
      where: { userId: userBigInt, status: SessionStatus.OPEN }
    });
    if (!session) {
      throw new NotFoundException('No active open cash session found for this cashier.');
    }

    // 1. Calculate Total Cash Inflows from Sales
    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        sale: { cashSessionId: session.id },
        paymentMethod: PaymentMethod.CASH,
        status: 'SUCCESS'
      },
      _sum: { amount: true }
    });
    const totalCashSales = Number(cashPayments._sum.amount || 0);

    // 2. Calculate Cash Refunds Disbursed
    const cashRefunds = await this.prisma.salesReturn.aggregate({
      where: {
        sale: { cashSessionId: session.id },
        refundMethod: 'CASH'
      },
      _sum: { refundTotal: true }
    });
    const totalCashRefunds = Number(cashRefunds._sum.refundTotal || 0);

    // 3. Calculate Petty Cash Expenses & Drops Outflows
    const expenses = await this.prisma.expense.aggregate({
      where: { cashSessionId: session.id },
      _sum: { amount: true }
    });
    const totalPettyExpenses = Number(expenses._sum.amount || 0);

    // 4. Compute Expected Cash in Drawer per DOC-02
    // Expected Cash = Opening Float + Cash In - Cash Out (Refunds + Drops + Expenses)
    const openingFloat = Number(session.openingFloat);
    const expectedAmount = openingFloat + totalCashSales - totalCashRefunds - totalPettyExpenses;
    const variance = dto.countedCash - expectedAmount;

    // 5. Update session to CLOSED
    return await this.prisma.cashSession.update({
      where: { id: session.id },
      data: {
        closingAmount: dto.countedCash,
        expectedAmount: expectedAmount,
        variance: variance,
        status: SessionStatus.CLOSED,
        notes: dto.notes || null,
        closedAt: new Date()
      }
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        skip,
        take: limit,
        include: {
          user: { select: { fullName: true, username: true } }
        },
        orderBy: { openedAt: 'desc' }
      }),
      this.prisma.cashSession.count()
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
}

