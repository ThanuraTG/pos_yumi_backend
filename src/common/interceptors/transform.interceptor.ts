import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prisma } from '@prisma/client';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

// Deep converter transforming BigInt to string and Prisma Decimal to number to allow safe JSON serialization
function serializeData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (
    Prisma.Decimal.isDecimal(obj) ||
    (typeof obj === 'object' && typeof obj.toNumber === 'function' && 'd' in obj && 's' in obj) ||
    (typeof obj === 'object' && obj.constructor?.name === 'Decimal')
  ) {
    return typeof obj.toNumber === 'function' ? obj.toNumber() : Number(obj.toString());
  }
  if (Array.isArray(obj)) return obj.map(serializeData);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = serializeData(obj[key]);
    }
    return res;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const response = ctx.getResponse();

    // Bypass standard JSON wrapper for Meta WhatsApp Webhooks so raw challenge string is returned
    if (req.url && (req.url.includes('webhook') || req.url.includes('/whatsapp/'))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: response.statusCode,
        data: serializeData(data),
        timestamp: new Date().toISOString()
      }))
    );
  }
}

