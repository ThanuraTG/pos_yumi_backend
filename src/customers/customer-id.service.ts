import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerIdService {
  private readonly logger = new Logger(CustomerIdService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a unique sequential Customer ID (CUS-0001, CUS-0002, ...)
   * Uses an atomic database sequence lock inside a Prisma interactive transaction.
   * Never reuses IDs on deletion.
   */
  async generateNextCustomerCode(tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || this.prisma;

    // Check or initialize the CustomerSequence row (id: 1)
    let sequence = await client.customerSequence.findUnique({
      where: { id: 1 }
    });

    if (!sequence) {
      // Find the highest existing CUS-XXXX number in the customer table
      const customersWithCode = await client.customer.findMany({
        where: { customerCode: { not: null } },
        select: { customerCode: true }
      });

      let maxNumber = 0;
      const prefix = process.env.CUSTOMER_CODE_PREFIX || 'CUS';
      const prefixHyphen = `${prefix}-`;
      for (const c of customersWithCode) {
        if (c.customerCode && c.customerCode.startsWith(prefixHyphen)) {
          const numPart = parseInt(c.customerCode.replace(prefixHyphen, ''), 10);
          if (!isNaN(numPart) && numPart > maxNumber) {
            maxNumber = numPart;
          }
        }
      }

      // If no customer has CUS-XXXX yet, count existing customers to avoid collision
      if (maxNumber === 0) {
        const totalCustomers = await client.customer.count();
        maxNumber = totalCustomers;
      }

      sequence = await client.customerSequence.create({
        data: {
          id: 1,
          lastNumber: maxNumber
        }
      });
      this.logger.log(`Initialized CustomerSequence counter at ${maxNumber}`);
    }

    // Atomic increment
    const updated = await client.customerSequence.update({
      where: { id: 1 },
      data: {
        lastNumber: { increment: 1 }
      }
    });

    const nextVal = updated.lastNumber;
    const formattedCode = this.formatCustomerCode(nextVal);
    this.logger.log(`Generated Customer ID: ${formattedCode}`);
    return formattedCode;
  }

  /**
   * Formats a sequential number into CUS-0001, CUS-9999, CUS-10000 format
   */
  formatCustomerCode(num: number): string {
    const prefix = process.env.CUSTOMER_CODE_PREFIX || 'CUS';
    const padded = num.toString().padStart(4, '0');
    return `${prefix}-${padded}`;
  }

  /**
   * Ensures all legacy existing customer records have a valid unique Customer ID
   */
  async backfillExistingCustomers(): Promise<number> {
    const unassigned = await this.prisma.customer.findMany({
      where: { customerCode: null },
      orderBy: { id: 'asc' }
    });

    if (unassigned.length === 0) return 0;

    this.logger.log(`Backfilling Customer IDs for ${unassigned.length} legacy customer records...`);
    let assignedCount = 0;

    for (const cust of unassigned) {
      const code = await this.generateNextCustomerCode();
      await this.prisma.customer.update({
        where: { id: cust.id },
        data: { customerCode: code }
      });
      assignedCount++;
    }

    this.logger.log(`Successfully assigned Customer IDs to ${assignedCount} legacy customers.`);
    return assignedCount;
  }
}
