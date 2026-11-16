import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    const appName = process.env.APP_NAME || 'PharmaSys';
    const currency = process.env.DEFAULT_CURRENCY || 'LKR';
    const apiPrefix = process.env.API_PREFIX || '/api/v1';
    const swaggerPath = process.env.SWAGGER_PATH || 'docs';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return {
      system: `${appName} Pharmacy POS & Management API`,
      version: process.env.APP_VERSION || '1.0.0',
      status: 'ONLINE',
      currency: `${currency} (Rs.)`,
      apiPrefix,
      documentation: `/${swaggerPath}`,
      frontendUrl,
      timestamp: new Date().toISOString()
    };
  }

  @Get('favicon.ico')
  @HttpCode(204)
  getFavicon() {
    return;
  }
}

