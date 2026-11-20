import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const appName = process.env.APP_NAME || 'PharmaSys';
  const logger = new Logger(`${appName}Bootstrap`);
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false // Allows Swagger UI and frontend assets to load without CSP blocks
  }));
  app.use(cookieParser());

  // High-capacity payload parser for high-res prescription scans & camera captures
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Global Prefix (exclude root status and docs)
  const apiPrefix = (process.env.API_PREFIX || '/api/v1').replace(/^\//, '');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', 'favicon.ico']
  });

  // Static directory for uploaded prescription scans and documents
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // CORS Configuration
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  });

  // Global Validation Pipe with DTO auto-transform
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true }
    })
  );

  // Global Exception Filter & Response Serialization Interceptor
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger API Documentation Setup
  const swaggerPath = process.env.SWAGGER_PATH || 'docs';
  const swaggerConfig = new DocumentBuilder()
    .setTitle(process.env.SWAGGER_TITLE || `${appName} Pharmacy Management REST API`)
    .setDescription(process.env.SWAGGER_DESCRIPTION || 'Complete Pharmacy POS, FEFO Batch Inventory, GRN Procurement, and Shift Management REST API')
    .setVersion(process.env.APP_VERSION || '1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(swaggerPath, app, document);

  // Serve Frontend Single Page Application (SPA) on root and all client routes
  const frontendDist = process.env.FRONTEND_DIST_PATH || join(__dirname, '../../frontend/dist');
  if (existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req: any, res: any, next: any) => {
      if (req.method === 'GET' && !req.path.startsWith(`/${apiPrefix}`) && !req.path.startsWith(`/${swaggerPath}`) && !req.path.startsWith('/uploads')) {
        const indexPath = join(frontendDist, 'index.html');
        if (existsSync(indexPath)) {
          return res.sendFile(indexPath);
        }
      }
      next();
    });
    logger.log(` Frontend SPA static assets mapped from: ${frontendDist}`);
  }

  const port = process.env.PORT || 5000;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  await app.listen(port, '0.0.0.0');
  logger.log(`====================================================`);
  logger.log(` ${appName} Backend & Web Application Online!`);
  logger.log(` Access System UI: http://localhost:${port}/`);
  logger.log(` POS Terminal:     http://localhost:${port}/pos`);
  logger.log(` Swagger Docs:     http://localhost:${port}/${swaggerPath}`);
  logger.log(` API Endpoint:     http://localhost:${port}/${apiPrefix}`);
  logger.log(` Vite Dev Server:  ${frontendUrl}`);
  logger.log(` Environment:      ${process.env.NODE_ENV || 'development'}`);
  logger.log(`====================================================`);
}
bootstrap();
