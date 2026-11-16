-- AlterTable
ALTER TABLE `customers` 
  ADD COLUMN `customer_code` VARCHAR(50) NULL,
  ADD COLUMN `birthday` DATE NULL,
  ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NULL,
  ADD COLUMN `has_whatsapp` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `whatsapp_number` VARCHAR(30) NULL,
  ADD COLUMN `district` VARCHAR(100) NULL,
  ADD COLUMN `city` VARCHAR(100) NULL,
  ADD COLUMN `family_member_name` VARCHAR(150) NULL,
  ADD COLUMN `family_member_phone` VARCHAR(30) NULL,
  ADD COLUMN `registration_source` ENUM('QR_CODE', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `phone_verification_status` ENUM('UNVERIFIED', 'VERIFIED', 'PENDING') NOT NULL DEFAULT 'VERIFIED',
  ADD COLUMN `privacy_consent` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `medicine_reminder_consent` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `customer_sequences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `last_number` INTEGER NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `customers_customer_code_key` ON `customers`(`customer_code`);
CREATE INDEX `customers_customer_code_idx` ON `customers`(`customer_code`);
CREATE INDEX `customers_registration_source_idx` ON `customers`(`registration_source`);
CREATE INDEX `customers_status_idx` ON `customers`(`status`);
