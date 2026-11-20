import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';
import { SessionStatus, PaymentMethod, SaleStatus } from '@prisma/client';

@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async autoCloseExpiredSessions(userId: bigint) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const expiredSessions = await this.prisma.cashSession.findMany({
      where: {
        userId,
        status: SessionStatus.OPEN,
        openedAt: { lt: todayStart }
      }
    });

    for (const session of expiredSessions) {
      const sessionEnd = new Date(session.openedAt);
      sessionEnd.setHours(23, 59, 59, 999);

      // Aggregate only sales that occurred during that session's calendar day
      const cashPayments = await this.prisma.payment.aggregate({
        where: {
          sale: {
            cashSessionId: session.id,
            createdAt: { lte: sessionEnd },
            status: { not: SaleStatus.VOIDED }
          },
          paymentMethod: PaymentMethod.CASH,
          status: 'SUCCESS'
        },
        _sum: { amount: true }
      });
      const totalCashSales = Number(cashPayments._sum.amount || 0);

      const cashRefunds = await this.prisma.salesReturn.aggregate({
        where: {
          sale: {
            cashSessionId: session.id,
            createdAt: { lte: sessionEnd }
          },
          refundMethod: 'CASH'
        },
        _sum: { refundTotal: true }
      });
      const totalCashRefunds = Number(cashRefunds._sum.refundTotal || 0);

      const expenses = await this.prisma.expense.aggregate({
        where: {
          cashSessionId: session.id,
          createdAt: { lte: sessionEnd }
        },
        _sum: { amount: true }
      });
      const totalPettyExpenses = Number(expenses._sum.amount || 0);

      const openingFloat = Number(session.openingFloat);
      const expectedAmount = openingFloat + totalCashSales - totalCashRefunds - totalPettyExpenses;

      await this.prisma.cashSession.update({
        where: { id: session.id },
        data: {
          closingAmount: expectedAmount,
          expectedAmount: expectedAmount,
          variance: 0,
          status: SessionStatus.CLOSED,
          notes: 'Auto-closed at end of day (Daily Rollover)',
          closedAt: sessionEnd
        }
      });
    }
  }

  async openSession(userId: string, dto: OpenSessionDto) {
    const userBigInt = BigInt(userId);

    // Auto-close any expired past day session
    await this.autoCloseExpiredSessions(userBigInt);

    // Check if cashier already has an open session for TODAY; if so, return it idempotently
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existing = await this.prisma.cashSession.findFirst({
      where: {
        userId: userBigInt,
        status: SessionStatus.OPEN,
        openedAt: { gte: todayStart }
      },
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
    const userBigInt = BigInt(userId);

    // 1. Auto-close any session left open from previous days
    await this.autoCloseExpiredSessions(userBigInt);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    let session = await this.prisma.cashSession.findFirst({
      where: {
        userId: userBigInt,
        status: SessionStatus.OPEN,
        openedAt: { gte: todayStart }
      },
      include: {
        user: { select: { fullName: true, username: true } },
        expenses: {
          where: { createdAt: { gte: todayStart, lte: todayEnd } },
          select: { id: true, amount: true, description: true, createdAt: true }
        }
      }
    });

    if (!session) {
      // Auto-open today's active session with default float (5000) so POS trading is always daily and ready
      session = await this.prisma.cashSession.create({
        data: {
          userId: userBigInt,
          openingFloat: 5000.0,
          status: SessionStatus.OPEN,
          notes: 'Daily Cash Register Session',
          openedAt: todayStart
        },
        include: {
          user: { select: { fullName: true, username: true } },
          expenses: {
            where: { createdAt: { gte: todayStart, lte: todayEnd } },
            select: { id: true, amount: true, description: true, createdAt: true }
          }
        }
      });

      // Re-link any sales made today to today's active session
      await this.prisma.sale.updateMany({
        where: {
          cashierId: userBigInt,
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        data: {
          cashSessionId: session.id
        }
      });
    }

    // 2. Calculate current expected cash on hand strictly for today
    const cashPayments = await this.prisma.payment.aggregate({
      where: {
        sale: {
          cashSessionId: session.id,
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: SaleStatus.VOIDED }
        },
        paymentMethod: PaymentMethod.CASH,
        status: 'SUCCESS'
      },
      _sum: { amount: true }
    });
    const totalCashSales = Number(cashPayments._sum.amount || 0);

    const cardPayments = await this.prisma.payment.aggregate({
      where: {
        sale: {
          cashSessionId: session.id,
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: SaleStatus.VOIDED }
        },
        paymentMethod: { in: [PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD] },
        status: 'SUCCESS'
      },
      _sum: { amount: true }
    });
    const totalCardSales = Number(cardPayments._sum.amount || 0);

    const bankPayments = await this.prisma.payment.aggregate({
      where: {
        sale: {
          cashSessionId: session.id,
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: SaleStatus.VOIDED }
        },
        paymentMethod: { in: [PaymentMethod.BANK_TRANSFER, PaymentMethod.LANKAPAY_QR] },
        status: 'SUCCESS'
      },
      _sum: { amount: true }
    });
    const totalBankSales = Number(bankPayments._sum.amount || 0);

    const cashRefunds = await this.prisma.salesReturn.aggregate({
      where: {
        sale: {
          cashSessionId: session.id,
          createdAt: { gte: todayStart, lte: todayEnd }
        },
        refundMethod: 'CASH'
      },
      _sum: { refundTotal: true }
    });
    const totalCashRefunds = Number(cashRefunds._sum.refundTotal || 0);

    const expensesSum = await this.prisma.expense.aggregate({
      where: {
        cashSessionId: session.id,
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      _sum: { amount: true }
    });
    const totalExpenses = Number(expensesSum._sum.amount || 0);

    const currentDrawerCash = Number(session.openingFloat) + totalCashSales - totalCashRefunds - totalExpenses;
    const totalSales = totalCashSales + totalCardSales + totalBankSales;

    return {
      ...session,
      currentDrawerCash,
      totalSales,
      totalCashSales,
      totalCardSales,
      totalBankSales,
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
          user: { select: { fullName: true, username: true } },
          sales: {
            where: { status: { not: SaleStatus.VOIDED } },
            select: {
              status: true,
              grandTotal: true,
              payments: {
                where: { status: 'SUCCESS' },
                select: { paymentMethod: true, amount: true }
              }
            }
          }
        },
        orderBy: { openedAt: 'desc' }
      }),
      this.prisma.cashSession.count()
    ]);

    const formatted = items.map((s: any) => {
      let cashTotal = 0;
      let cardTotal = 0;
      let bankTotal = 0;
      let grossTotal = 0;

      for (const sale of s.sales || []) {
        if (sale.status === 'VOIDED') continue;
        grossTotal += Number(sale.grandTotal || 0);
        for (const p of sale.payments || []) {
          const amt = Number(p.amount || 0);
          if (p.paymentMethod === 'CASH') cashTotal += amt;
          else if (p.paymentMethod === 'CREDIT_CARD' || p.paymentMethod === 'DEBIT_CARD') cardTotal += amt;
          else if (p.paymentMethod === 'BANK_TRANSFER' || p.paymentMethod === 'LANKAPAY_QR') bankTotal += amt;
        }
      }

      const { sales, ...rest } = s;
      return {
        ...rest,
        totalSales: grossTotal,
        totalCashSales: cashTotal,
        totalCardSales: cardTotal,
        totalBankSales: bankTotal
      };
    });

    return {
      items: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
}

