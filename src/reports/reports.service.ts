import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportsService {
  private readonly currency = process.env.DEFAULT_CURRENCY || 'LKR';

  constructor(private readonly prisma: PrismaService) {}

  async getSalesReport(dateFrom?: string, dateTo?: string) {
    const where: any = { status: 'COMPLETED' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { fullName: true } },
        items: {
          include: { medicine: { select: { name: true, brandName: true } } }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const totalDiscounts = sales.reduce((sum, s) => sum + Number(s.discountAmount), 0);
    const totalTransactions = sales.length;

    return {
      summary: {
        totalRevenue,
        totalDiscounts,
        totalTransactions,
        averageTicketValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0
      },
      transactions: sales
    };
  }

  async getPnlStatement(dateFrom?: string, dateTo?: string) {
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const saleWhere: any = { status: 'COMPLETED' };
    if (dateFrom || dateTo) saleWhere.createdAt = dateFilter;

    // 1. Fetch Sales and Compute Billed Revenue & Exact COGS via snapshots
    const sales = await this.prisma.sale.findMany({
      where: saleWhere,
      include: { items: true }
    });

    let netRevenue = 0;
    let totalCogs = 0;

    for (const s of sales) {
      netRevenue += Number(s.grandTotal);
      for (const item of s.items) {
        totalCogs += Number(item.quantity) * Number(item.unitCostSnapshot);
      }
    }

    const grossProfit = netRevenue - totalCogs;
    const grossMarginPercent = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // 2. Fetch Operating Expenses
    const expenseWhere: any = {};
    if (dateFrom || dateTo) expenseWhere.expenseDate = dateFilter;

    const expenses = await this.prisma.expense.findMany({
      where: expenseWhere,
      include: { category: true }
    });

    const totalOperatingExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      financials: {
        netRevenue,
        costOfGoodsSold: totalCogs,
        grossProfit,
        grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
        totalOperatingExpenses,
        netProfit,
        netMarginPercent: netRevenue > 0 ? Number(((netProfit / netRevenue) * 100).toFixed(2)) : 0,
        currency: this.currency
      },
      expensesBreakdown: expenses
    };
  }

  async getStockValuation() {
    const batches = await this.prisma.medicineBatch.findMany({
      where: {
        quantityOnHand: { gt: 0 }
      },
      include: {
        medicine: { select: { name: true, brandName: true, skuCode: true } }
      }
    });

    let totalValuationAtCost = 0;
    let totalValuationAtRetail = 0;

    const items = batches.map((b) => {
      const qoh = Number(b.quantityOnHand);
      const costVal = qoh * Number(b.costPrice);
      const retailVal = qoh * Number(b.sellingPrice);

      totalValuationAtCost += costVal;
      totalValuationAtRetail += retailVal;

      return {
        batchId: b.id,
        medicineName: b.medicine.name,
        brandName: b.medicine.brandName,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        quantityOnHand: qoh,
        costPrice: Number(b.costPrice),
        sellingPrice: Number(b.sellingPrice),
        valuationAtCost: costVal,
        valuationAtRetail: retailVal,
        status: b.status
      };
    });

    return {
      summary: {
        totalBatches: batches.length,
        totalValuationAtCost,
        totalValuationAtRetail,
        potentialGrossProfit: totalValuationAtRetail - totalValuationAtCost,
        currency: this.currency
      },
      items
    };
  }

  async getLowStockAlerts() {
    const medicines = await this.prisma.medicine.findMany({
      where: {
        isActive: true,
        deletedAt: null
      },
      include: {
        batches: {
          where: {
            status: 'ACTIVE',
            quantityOnHand: { gt: 0 },
            expiryDate: { gt: new Date() }
          }
        },
        category: true
      }
    });

    const lowStockItems = medicines
      .map((med) => {
        const totalStock = med.batches.reduce((sum, b) => sum + Number(b.quantityOnHand), 0);
        const reorderThreshold = Number(med.reorderLevel);
        return {
          id: med.id,
          skuCode: med.skuCode,
          brandName: med.brandName,
          name: med.name,
          strength: med.strength,
          category: med.category?.name,
          currentStock: totalStock,
          reorderLevel: reorderThreshold,
          shortfall: Math.max(0, reorderThreshold - totalStock),
          isCriticallyLow: totalStock <= reorderThreshold
        };
      })
      .filter((item) => item.isCriticallyLow);

    return {
      totalAlerts: lowStockItems.length,
      items: lowStockItems
    };
  }

  async getControlledDrugsRegister(dateFrom?: string, dateTo?: string) {
    const where: any = {
      sale: {
        status: 'COMPLETED'
      },
      medicine: {
        OR: [
          { isNarcotic: true },
          { prescriptionRequired: true }
        ]
      }
    };

    if (dateFrom || dateTo) {
      where.sale.createdAt = {};
      if (dateFrom) where.sale.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.sale.createdAt.lte = new Date(dateTo);
    }

    const saleItems = await this.prisma.saleItem.findMany({
      where,
      include: {
        medicine: true,
        batch: true,
        sale: {
          include: {
            cashier: { select: { fullName: true } },
            customer: true,
            prescription: true
          }
        }
      },
      orderBy: { sale: { createdAt: 'desc' } }
    });

    return saleItems.map((si) => ({
      saleId: si.saleId,
      invoiceNumber: si.sale.invoiceNumber,
      dispensedAt: si.sale.createdAt,
      medicineName: si.medicine.name,
      brandName: si.medicine.brandName,
      isNarcotic: si.medicine.isNarcotic,
      batchNumber: si.batch.batchNumber,
      quantityDispensed: Number(si.quantity),
      patientName: si.sale.customer?.name || 'Walk-in Patient',
      doctorName: si.sale.prescription?.doctorName || 'Not recorded',
      doctorSlmcNo: si.sale.prescription?.doctorSlmcNo || 'N/A',
      cashier: si.sale.cashier.fullName
    }));
  }

  async getExpiryReport(days = 60) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(days));

    const batches = await this.prisma.medicineBatch.findMany({
      where: {
        quantityOnHand: { gt: 0 },
        expiryDate: {
          lte: targetDate
        }
      },
      include: {
        medicine: true
      },
      orderBy: { expiryDate: 'asc' }
    });

    const now = new Date();
    return batches.map((b) => {
      const exp = new Date(b.expiryDate);
      const daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
      return {
        batchId: b.id,
        batchNumber: b.batchNumber,
        medicineName: b.medicine.name,
        brandName: b.medicine.brandName,
        expiryDate: b.expiryDate,
        quantityOnHand: Number(b.quantityOnHand),
        costPrice: Number(b.costPrice),
        sellingPrice: Number(b.sellingPrice),
        daysRemaining,
        status: daysRemaining <= 0 ? 'EXPIRED' : daysRemaining <= 30 ? 'CRITICAL' : 'NEAR_EXPIRY'
      };
    });
  }

  async getPurchasesReport(dateFrom?: string, dateTo?: string) {
    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const purchases = await this.prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        creator: { select: { fullName: true } },
        items: { include: { medicine: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalSpend = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

    return {
      summary: {
        totalPurchases: purchases.length,
        totalSpend,
        currency: this.currency
      },
      purchases: purchases.map((p) => ({
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        supplierName: p.supplier.name,
        supplierInvoiceNo: p.supplierInvoiceNo,
        status: p.status,
        totalAmount: Number(p.totalAmount),
        amountPaid: Number(p.amountPaid),
        receivedAt: p.receivedAt,
        itemCount: p.items.length,
        createdBy: p.creator.fullName
      }))
    };
  }

  async getDashboardOverview(period = 'today', dateFrom?: string, dateTo?: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

    let periodStart: Date | undefined;
    let periodEnd: Date | undefined = todayEnd;

    if (period === 'today') {
      periodStart = todayStart;
      periodEnd = todayEnd;
    } else if (period === 'week') {
      periodStart = weekStart;
      periodEnd = todayEnd;
    } else if (period === 'month') {
      periodStart = monthStart;
      periodEnd = todayEnd;
    } else if (period === 'year') {
      periodStart = yearStart;
      periodEnd = todayEnd;
    } else if (dateFrom || dateTo) {
      if (dateFrom) periodStart = new Date(dateFrom);
      if (dateTo) periodEnd = new Date(dateTo);
    } else {
      // all time
      periodStart = undefined;
      periodEnd = undefined;
    }

    // 1. Sales Summaries (Today, Week, Month)
    const [todaySales, weekSales, monthSales, periodSales] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } },
        select: { grandTotal: true }
      }),
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: weekStart, lte: todayEnd } },
        select: { grandTotal: true }
      }),
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: monthStart, lte: todayEnd } },
        select: { grandTotal: true }
      }),
      this.prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          ...(periodStart || periodEnd
            ? {
                createdAt: {
                  ...(periodStart ? { gte: periodStart } : {}),
                  ...(periodEnd ? { lte: periodEnd } : {})
                }
              }
            : {})
        },
        include: {
          cashier: { select: { fullName: true } },
          customer: { select: { name: true, phone: true } },
          items: {
            include: {
              medicine: { select: { id: true, name: true, brandName: true, skuCode: true } }
            }
          },
          payments: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const todayTxCount = todaySales.length;

    const weekRevenue = weekSales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const weekTxCount = weekSales.length;

    const monthRevenue = monthSales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const monthTxCount = monthSales.length;

    const periodRevenue = periodSales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
    const periodDiscounts = periodSales.reduce((sum, s) => sum + Number(s.discountAmount), 0);
    const periodTxCount = periodSales.length;
    const periodAvgTicket = periodTxCount > 0 ? periodRevenue / periodTxCount : 0;

    // 2. COGS & Profit for selected period
    let periodCogs = 0;
    const medicineSalesMap = new Map<
      string,
      { id: string; name: string; brandName: string; skuCode: string; unitsSold: number; totalRevenue: number }
    >();

    let cashTotal = 0;
    let cardTotal = 0;
    let qrTotal = 0;
    let otherTotal = 0;

    for (const s of periodSales) {
      for (const item of s.items) {
        const qty = Number(item.quantity);
        const costSnapshot = Number(item.unitCostSnapshot || 0);
        periodCogs += qty * costSnapshot;

        // Best selling tracker
        const medId = item.medicineId.toString();
        const existing = medicineSalesMap.get(medId) || {
          id: medId,
          name: item.medicine?.name || 'Unknown',
          brandName: item.medicine?.brandName || '',
          skuCode: item.medicine?.skuCode || '',
          unitsSold: 0,
          totalRevenue: 0
        };
        existing.unitsSold += qty;
        existing.totalRevenue += Number(item.lineTotal || 0);
        medicineSalesMap.set(medId, existing);
      }

      // Payments breakdown
      for (const p of s.payments) {
        const amt = Number(p.amount);
        if (p.paymentMethod === 'CASH') cashTotal += amt;
        else if (p.paymentMethod === 'CREDIT_CARD' || p.paymentMethod === 'DEBIT_CARD') cardTotal += amt;
        else if (p.paymentMethod === 'LANKAPAY_QR') qrTotal += amt;
        else otherTotal += amt;
      }
    }

    const grossProfit = periodRevenue - periodCogs;
    const grossMarginPercent = periodRevenue > 0 ? (grossProfit / periodRevenue) * 100 : 0;

    // Operating expenses in period
    const expenses = await this.prisma.expense.findMany({
      where:
        periodStart || periodEnd
          ? {
              expenseDate: {
                ...(periodStart ? { gte: periodStart } : {}),
                ...(periodEnd ? { lte: periodEnd } : {})
              }
            }
          : {}
    });
    const totalOperatingExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPercent = periodRevenue > 0 ? (netProfit / periodRevenue) * 100 : 0;

    // 3. Purchases Summary
    const purchases = await this.prisma.purchase.findMany({
      where:
        periodStart || periodEnd
          ? {
              createdAt: {
                ...(periodStart ? { gte: periodStart } : {}),
                ...(periodEnd ? { lte: periodEnd } : {})
              }
            }
          : {},
      include: {
        supplier: { select: { name: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalPurchasesSpend = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
    const totalPurchasesCount = purchases.length;
    const totalPurchasesPaid = purchases.reduce((sum, p) => sum + Number(p.amountPaid), 0);
    const totalPurchasesPending = totalPurchasesSpend - totalPurchasesPaid;

    const recentPurchases = purchases.slice(0, 8).map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplierName: p.supplier?.name || 'Unknown Supplier',
      supplierInvoiceNo: p.supplierInvoiceNo || '-',
      status: p.status,
      totalAmount: Number(p.totalAmount),
      amountPaid: Number(p.amountPaid),
      receivedAt: p.receivedAt || p.createdAt,
      itemCount: p.items.length
    }));

    // 4. Current Stock Summary
    const [activeBatches, allMedicines, activeSession] = await Promise.all([
      this.prisma.medicineBatch.findMany({
        where: { quantityOnHand: { gt: 0 } },
        include: {
          medicine: {
            select: {
              id: true,
              name: true,
              brandName: true,
              skuCode: true,
              reorderLevel: true,
              isActive: true,
              category: { select: { name: true } }
            }
          }
        },
        orderBy: { expiryDate: 'asc' }
      }),
      this.prisma.medicine.findMany({
        where: { isActive: true, deletedAt: null },
        include: { category: { select: { name: true } } }
      }),
      this.prisma.cashSession.findFirst({
        where: { status: 'OPEN' },
        include: { user: { select: { fullName: true } } },
        orderBy: { openedAt: 'desc' }
      })
    ]);

    let totalValuationAtCost = 0;
    let totalValuationAtRetail = 0;
    let totalStockUnits = 0;
    const inStockMedicineIds = new Set<string>();

    const expiredBatches: any[] = [];
    const nearExpiryBatches: any[] = [];
    let expiredTotalCost = 0;

    for (const b of activeBatches) {
      const qoh = Number(b.quantityOnHand);
      const cost = Number(b.costPrice);
      const retail = Number(b.sellingPrice);

      totalStockUnits += qoh;
      totalValuationAtCost += qoh * cost;
      totalValuationAtRetail += qoh * retail;
      inStockMedicineIds.add(b.medicineId.toString());

      // Expiry check
      const exp = new Date(b.expiryDate);
      const daysRemaining = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysRemaining <= 0) {
        expiredTotalCost += qoh * cost;
        expiredBatches.push({
          id: b.id,
          batchNumber: b.batchNumber,
          medicineName: b.medicine?.name || 'Unknown',
          brandName: b.medicine?.brandName || '',
          expiryDate: b.expiryDate,
          quantityOnHand: qoh,
          costPrice: cost,
          sellingPrice: retail,
          totalLostValue: qoh * cost,
          daysAgo: Math.abs(daysRemaining)
        });
      } else if (daysRemaining <= 90) {
        nearExpiryBatches.push({
          id: b.id,
          batchNumber: b.batchNumber,
          medicineName: b.medicine?.name || 'Unknown',
          brandName: b.medicine?.brandName || '',
          expiryDate: b.expiryDate,
          quantityOnHand: qoh,
          costPrice: cost,
          sellingPrice: retail,
          daysRemaining,
          severity: daysRemaining <= 30 ? 'CRITICAL' : 'WARNING'
        });
      }
    }

    const totalMedicinesCount = allMedicines.length;
    const outOfStockCount = allMedicines.filter((m) => !inStockMedicineIds.has(m.id.toString())).length;

    // Low stock calculation
    const lowStockMedicines = allMedicines
      .map((med) => {
        const medBatches = activeBatches.filter((b) => b.medicineId.toString() === med.id.toString());
        const currentStock = medBatches.reduce((sum, b) => sum + Number(b.quantityOnHand), 0);
        const reorderLevel = Number(med.reorderLevel || 50);
        return {
          id: med.id,
          skuCode: med.skuCode,
          name: med.name,
          brandName: med.brandName,
          category: med.category?.name || 'General',
          currentStock,
          reorderLevel,
          shortfall: Math.max(0, reorderLevel - currentStock),
          isLow: currentStock <= reorderLevel
        };
      })
      .filter((m) => m.isLow);

    // Best Selling Top 6
    const bestSellingMedicines = Array.from(medicineSalesMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 6);

    // Recent Sales
    const recentSales = periodSales.slice(0, 8).map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      createdAt: s.createdAt,
      cashierName: s.cashier?.fullName || 'Cashier',
      customerName: s.customer?.name || 'Walk-in Customer',
      itemsCount: s.items.length,
      grandTotal: Number(s.grandTotal),
      discountAmount: Number(s.discountAmount),
      status: s.status,
      paymentMethod: s.payments?.[0]?.paymentMethod || 'CASH'
    }));

    // Chart Data (Last 7 Days comparative daily trend)
    const chartDays: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const [daySales, dayPurchases] = await Promise.all([
        this.prisma.sale.findMany({
          where: { status: 'COMPLETED', createdAt: { gte: dayStart, lte: dayEnd } },
          include: { items: true }
        }),
        this.prisma.purchase.findMany({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
          select: { totalAmount: true }
        })
      ]);

      const salesTotal = daySales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
      let cogsTotal = 0;
      for (const s of daySales) {
        for (const item of s.items) {
          cogsTotal += Number(item.quantity) * Number(item.unitCostSnapshot || 0);
        }
      }
      const purchasesTotal = dayPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

      chartDays.push({
        date: dayStr,
        label: dayLabel,
        sales: salesTotal,
        purchases: purchasesTotal,
        profit: salesTotal - cogsTotal
      });
    }

    return {
      summary: {
        period,
        todaySales: { revenue: todayRevenue, txCount: todayTxCount },
        weeklySales: { revenue: weekRevenue, txCount: weekTxCount },
        monthlySales: { revenue: monthRevenue, txCount: monthTxCount },
        periodSales: {
          revenue: periodRevenue,
          discounts: periodDiscounts,
          txCount: periodTxCount,
          avgTicket: Number(periodAvgTicket.toFixed(2))
        },
        purchases: {
          totalSpend: totalPurchasesSpend,
          totalCount: totalPurchasesCount,
          paidAmount: totalPurchasesPaid,
          pendingAmount: totalPurchasesPending
        },
        profit: {
          revenue: periodRevenue,
          cogs: periodCogs,
          grossProfit,
          grossMarginPercent: Number(grossMarginPercent.toFixed(2)),
          operatingExpenses: totalOperatingExpenses,
          netProfit,
          netMarginPercent: Number(netMarginPercent.toFixed(2))
        },
        stock: {
          totalMedicines: totalMedicinesCount,
          totalStockUnits,
          valuationAtCost: totalValuationAtCost,
          valuationAtRetail: totalValuationAtRetail,
          potentialGrossProfit: totalValuationAtRetail - totalValuationAtCost,
          outOfStockCount,
          lowStockCount: lowStockMedicines.length
        },
        cashFlow: {
          cash: cashTotal,
          card: cardTotal,
          qr: qrTotal,
          other: otherTotal,
          totalInflow: cashTotal + cardTotal + qrTotal + otherTotal,
          activeSession: activeSession
            ? {
                id: activeSession.id,
                cashierName: activeSession.user?.fullName || 'Active Cashier',
                openingFloat: Number(activeSession.openingFloat),
                openedAt: activeSession.openedAt,
                status: activeSession.status
              }
            : null
        }
      },
      alerts: {
        lowStock: {
          count: lowStockMedicines.length,
          items: lowStockMedicines.slice(0, 8)
        },
        expired: {
          count: expiredBatches.length,
          totalLostValue: expiredTotalCost,
          items: expiredBatches.slice(0, 8)
        },
        nearExpiry: {
          count: nearExpiryBatches.length,
          criticalCount: nearExpiryBatches.filter((b) => b.severity === 'CRITICAL').length,
          items: nearExpiryBatches.slice(0, 8)
        }
      },
      bestSelling: bestSellingMedicines,
      recentSales,
      recentPurchases,
      charts: {
        trends: chartDays
      }
    };
  }

  async getSalesReturnsReport(dateFrom?: string, dateTo?: string) {
    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const returns = await this.prisma.salesReturn.findMany({
      where,
      include: {
        sale: {
          select: {
            invoiceNumber: true,
            customer: { select: { name: true, phone: true } }
          }
        },
        processor: { select: { fullName: true } },
        approver: { select: { fullName: true } },
        returnItems: {
          include: {
            batch: {
              include: { medicine: { select: { name: true, brandName: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalRefund = returns.reduce((sum, r) => sum + Number(r.refundTotal), 0);

    return {
      summary: {
        totalReturns: returns.length,
        totalRefundAmount: totalRefund,
        currency: this.currency
      },
      returns: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        invoiceNumber: r.sale?.invoiceNumber || '-',
        customerName: r.sale?.customer?.name || 'Walk-in',
        customerPhone: r.sale?.customer?.phone || '-',
        refundTotal: Number(r.refundTotal),
        refundMethod: r.refundMethod,
        reason: r.reason,
        processedBy: r.processor?.fullName || 'Cashier',
        approvedBy: r.approver?.fullName || 'Manager',
        createdAt: r.createdAt,
        itemCount: r.returnItems.length,
        items: r.returnItems.map((item) => ({
          medicineName: item.batch?.medicine?.name || 'Unknown',
          brandName: item.batch?.medicine?.brandName || '',
          batchNumber: item.batch?.batchNumber || '-',
          returnQuantity: Number(item.returnQuantity),
          refundAmount: Number(item.refundAmount),
          restockStatus: item.restockStatus
        }))
      }))
    };
  }

  async getPurchaseReturnsReport(dateFrom?: string, dateTo?: string) {
    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const returns = await this.prisma.purchaseReturn.findMany({
      where,
      include: {
        supplier: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalCredit = returns.reduce((sum, r) => sum + Number(r.totalAmount), 0);

    return {
      summary: {
        totalReturns: returns.length,
        totalCreditNoteAmount: totalCredit,
        currency: this.currency
      },
      returns: returns.map((r) => ({
        id: r.id,
        returnNumber: r.returnNumber,
        supplierName: r.supplier?.name || 'Unknown',
        supplierPhone: r.supplier?.phone || '-',
        totalAmount: Number(r.totalAmount),
        notes: r.notes,
        createdAt: r.createdAt,
        itemCount: r.items.length
      }))
    };
  }

  async getCustomersReport() {
    const customers = await this.prisma.customer.findMany({
      include: {
        sales: {
          where: { status: 'COMPLETED' },
          select: { grandTotal: true, createdAt: true }
        },
        patients: { select: { id: true } }
      },
      orderBy: { name: 'asc' }
    });

    let totalOutstanding = 0;
    let totalLifetimeRevenue = 0;

    const formatted = customers.map((c) => {
      const balance = Number(c.outstandingBalance || 0);
      const spend = c.sales.reduce((sum, s) => sum + Number(s.grandTotal), 0);
      totalOutstanding += balance;
      totalLifetimeRevenue += spend;

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        outstandingBalance: balance,
        totalSpend: spend,
        purchaseCount: c.sales.length,
        patientCount: c.patients.length,
        whatsappConsent: c.whatsappConsent,
        loyaltyPoints: Math.floor(spend / 100)
      };
    });

    const topCustomers = [...formatted].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 15);
    const debtors = formatted.filter((c) => c.outstandingBalance > 0).sort((a, b) => b.outstandingBalance - a.outstandingBalance);

    return {
      summary: {
        totalCustomers: customers.length,
        totalOutstandingCredit: totalOutstanding,
        totalLifetimeRevenue,
        activeDebtorsCount: debtors.length
      },
      topCustomers,
      debtors,
      allCustomers: formatted
    };
  }

  async getSuppliersReport() {
    const suppliers = await this.prisma.supplier.findMany({
      include: {
        purchases: {
          select: { totalAmount: true, amountPaid: true, createdAt: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    let totalPayables = 0;
    let totalPurchasesSum = 0;

    const formatted = suppliers.map((s) => {
      const balance = Number(s.currentBalance || 0);
      const totalPurchased = s.purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
      const totalPaid = s.purchases.reduce((sum, p) => sum + Number(p.amountPaid), 0);

      totalPayables += balance;
      totalPurchasesSum += totalPurchased;

      return {
        id: s.id,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        paymentTerms: s.paymentTerms,
        creditLimit: Number(s.creditLimit || 0),
        currentBalance: balance,
        totalPurchased,
        totalPaid,
        orderCount: s.purchases.length
      };
    });

    return {
      summary: {
        totalSuppliers: suppliers.length,
        totalOutstandingPayables: totalPayables,
        totalPurchasesVolume: totalPurchasesSum
      },
      suppliers: formatted
    };
  }

  async getCashFlowReport(dateFrom?: string, dateTo?: string) {
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const [cashSales, cashExpenses, cashReturns] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          paymentMethod: 'CASH',
          status: 'SUCCESS',
          ...(dateFrom || dateTo ? { createdAt: dateFilter } : {})
        },
        select: { amount: true }
      }),
      this.prisma.expense.findMany({
        where: dateFrom || dateTo ? { expenseDate: dateFilter } : {},
        select: { amount: true }
      }),
      this.prisma.salesReturn.findMany({
        where: {
          refundMethod: 'CASH',
          ...(dateFrom || dateTo ? { createdAt: dateFilter } : {})
        },
        select: { refundTotal: true }
      })
    ]);

    const cashInflows = cashSales.reduce((sum, p) => sum + Number(p.amount), 0);
    const expensesOutflow = cashExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const refundsOutflow = cashReturns.reduce((sum, r) => sum + Number(r.refundTotal), 0);
    const totalOutflows = expensesOutflow + refundsOutflow;
    const netCashPosition = cashInflows - totalOutflows;

    return {
      summary: {
        cashInflows,
        expensesOutflow,
        refundsOutflow,
        totalOutflows,
        netCashPosition,
        currency: this.currency
      }
    };
  }

  async getPaymentMethodsReport(dateFrom?: string, dateTo?: string) {
    const where: any = { status: 'SUCCESS' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const payments = await this.prisma.payment.findMany({
      where,
      select: {
        paymentMethod: true,
        amount: true
      }
    });

    const breakdownMap: Record<string, { count: number; total: number }> = {};
    let totalAll = 0;

    for (const p of payments) {
      const method = p.paymentMethod;
      const amt = Number(p.amount);
      totalAll += amt;

      if (!breakdownMap[method]) {
        breakdownMap[method] = { count: 0, total: 0 };
      }
      breakdownMap[method].count += 1;
      breakdownMap[method].total += amt;
    }

    const result = Object.entries(breakdownMap).map(([method, data]) => ({
      method,
      count: data.count,
      totalAmount: data.total,
      percentage: totalAll > 0 ? Number(((data.total / totalAll) * 100).toFixed(2)) : 0
    }));

    return {
      totalCollected: totalAll,
      totalTransactions: payments.length,
      breakdown: result
    };
  }

  async getStaffPerformanceReport(dateFrom?: string, dateTo?: string) {
    const where: any = { status: 'COMPLETED' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const sales = await this.prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true, username: true } },
        items: true
      }
    });

    const staffMap = new Map<
      string,
      {
        id: string;
        fullName: string;
        username: string;
        invoicesCount: number;
        totalRevenue: number;
        totalDiscounts: number;
        itemsSold: number;
      }
    >();

    for (const s of sales) {
      const cashierId = s.cashierId.toString();
      const existing = staffMap.get(cashierId) || {
        id: cashierId,
        fullName: s.cashier?.fullName || 'Unknown Cashier',
        username: s.cashier?.username || 'user',
        invoicesCount: 0,
        totalRevenue: 0,
        totalDiscounts: 0,
        itemsSold: 0
      };

      existing.invoicesCount += 1;
      existing.totalRevenue += Number(s.grandTotal);
      existing.totalDiscounts += Number(s.discountAmount);
      existing.itemsSold += s.items.reduce((sum, item) => sum + Number(item.quantity), 0);

      staffMap.set(cashierId, existing);
    }

    const staffList = Array.from(staffMap.values()).map((st) => ({
      ...st,
      avgInvoiceValue: st.invoicesCount > 0 ? Number((st.totalRevenue / st.invoicesCount).toFixed(2)) : 0
    }));

    return {
      summary: {
        activeStaffCount: staffList.length,
        totalSalesRecorded: sales.reduce((sum, s) => sum + Number(s.grandTotal), 0)
      },
      staff: staffList.sort((a, b) => b.totalRevenue - a.totalRevenue)
    };
  }

  async getMedicineMovementReport(dateFrom?: string, dateTo?: string) {
    const [allMedicines, batches, periodSales] = await Promise.all([
      this.prisma.medicine.findMany({
        where: { isActive: true, deletedAt: null },
        include: { category: { select: { name: true } } }
      }),
      this.prisma.medicineBatch.findMany({
        where: { quantityOnHand: { gt: 0 } },
        select: { medicineId: true, quantityOnHand: true, costPrice: true, sellingPrice: true }
      }),
      this.prisma.saleItem.findMany({
        where: {
          sale: {
            status: 'COMPLETED',
            ...(dateFrom || dateTo
              ? {
                  createdAt: {
                    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                    ...(dateTo ? { lte: new Date(dateTo) } : {})
                  }
                }
              : {})
          }
        },
        select: { medicineId: true, quantity: true, lineTotal: true }
      })
    ]);

    // Stock on hand per medicine
    const stockMap = new Map<string, { currentStock: number; totalCost: number; totalRetail: number }>();
    for (const b of batches) {
      const mid = b.medicineId.toString();
      const cur = stockMap.get(mid) || { currentStock: 0, totalCost: 0, totalRetail: 0 };
      const q = Number(b.quantityOnHand);
      cur.currentStock += q;
      cur.totalCost += q * Number(b.costPrice);
      cur.totalRetail += q * Number(b.sellingPrice);
      stockMap.set(mid, cur);
    }

    // Units sold per medicine
    const soldMap = new Map<string, { unitsSold: number; revenue: number }>();
    for (const item of periodSales) {
      const mid = item.medicineId.toString();
      const cur = soldMap.get(mid) || { unitsSold: 0, revenue: 0 };
      cur.unitsSold += Number(item.quantity);
      cur.revenue += Number(item.lineTotal);
      soldMap.set(mid, cur);
    }

    const items = allMedicines.map((m) => {
      const mid = m.id.toString();
      const stock = stockMap.get(mid) || { currentStock: 0, totalCost: 0, totalRetail: 0 };
      const sales = soldMap.get(mid) || { unitsSold: 0, revenue: 0 };

      return {
        id: m.id,
        skuCode: m.skuCode,
        name: m.name,
        brandName: m.brandName,
        category: m.category?.name || 'General',
        currentStock: stock.currentStock,
        valuationAtCost: stock.totalCost,
        unitsSold: sales.unitsSold,
        salesRevenue: sales.revenue,
        movementSpeed:
          sales.unitsSold > 50
            ? 'FAST'
            : sales.unitsSold > 10
            ? 'MEDIUM'
            : sales.unitsSold > 0
            ? 'SLOW'
            : 'NON_MOVING'
      };
    });

    const bestSelling = [...items].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 20);
    const slowMoving = [...items]
      .filter((m) => m.currentStock > 0 && m.unitsSold <= 5)
      .sort((a, b) => b.valuationAtCost - a.valuationAtCost);

    return {
      summary: {
        totalMedicinesEvaluated: items.length,
        fastMovingCount: items.filter((m) => m.movementSpeed === 'FAST').length,
        slowMovingCount: items.filter((m) => m.movementSpeed === 'SLOW').length,
        deadStockCount: items.filter((m) => m.movementSpeed === 'NON_MOVING' && m.currentStock > 0).length
      },
      bestSelling,
      slowMoving
    };
  }
}

