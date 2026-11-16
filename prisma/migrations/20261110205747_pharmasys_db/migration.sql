-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(100) NOT NULL,
    `module` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` BIGINT UNSIGNED NOT NULL,
    `role_id` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` BIGINT UNSIGNED NOT NULL,
    `permission_id` BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `action` VARCHAR(50) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `before_state` JSON NULL,
    `after_state` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_name_key`(`name`),
    UNIQUE INDEX `categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manufacturers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `country` VARCHAR(100) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manufacturers_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `generic_molecules` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `therapeutic_class` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `generic_molecules_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicines` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `manufacturer_id` BIGINT UNSIGNED NULL,
    `generic_id` BIGINT UNSIGNED NULL,
    `name` VARCHAR(150) NOT NULL,
    `brand_name` VARCHAR(150) NOT NULL,
    `sku_code` VARCHAR(50) NOT NULL,
    `barcode` VARCHAR(100) NULL,
    `strength` VARCHAR(50) NOT NULL,
    `dosage_form` ENUM('TABLET', 'CAPSULE', 'SYRUP', 'SUSPENSION', 'INJECTION', 'CREAM', 'OINTMENT', 'DROPS', 'INHALER', 'OTHER') NOT NULL,
    `base_unit` VARCHAR(30) NOT NULL DEFAULT 'TABLET',
    `prescription_required` BOOLEAN NOT NULL DEFAULT false,
    `is_narcotic` BOOLEAN NOT NULL DEFAULT false,
    `reorder_level` DECIMAL(12, 3) NOT NULL DEFAULT 50.000,
    `storage_condition` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicines_sku_code_key`(`sku_code`),
    UNIQUE INDEX `medicines_barcode_key`(`barcode`),
    INDEX `medicines_brand_name_idx`(`brand_name`),
    INDEX `medicines_barcode_idx`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_units` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `medicine_id` BIGINT UNSIGNED NOT NULL,
    `unit_name` VARCHAR(50) NOT NULL,
    `base_unit_factor` DECIMAL(12, 3) NOT NULL,
    `barcode` VARCHAR(100) NULL,
    `is_sellable` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicine_units_barcode_key`(`barcode`),
    UNIQUE INDEX `medicine_units_medicine_id_unit_name_key`(`medicine_id`, `unit_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicine_batches` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `medicine_id` BIGINT UNSIGNED NOT NULL,
    `batch_number` VARCHAR(100) NOT NULL,
    `mfg_date` DATE NULL,
    `expiry_date` DATE NOT NULL,
    `cost_price` DECIMAL(12, 2) NOT NULL,
    `selling_price` DECIMAL(12, 2) NOT NULL,
    `quantity_on_hand` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `status` ENUM('ACTIVE', 'NEAR_EXPIRY', 'EXPIRED', 'QUARANTINED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `medicine_batches_expiry_date_idx`(`expiry_date`),
    INDEX `medicine_batches_status_idx`(`status`),
    UNIQUE INDEX `medicine_batches_medicine_id_batch_number_key`(`medicine_id`, `batch_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `movement_type` ENUM('PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT_DAMAGE', 'ADJUSTMENT_LOST', 'PHYSICAL_COUNT_VARIANCE') NOT NULL,
    `quantity_delta` DECIMAL(12, 3) NOT NULL,
    `balance_after` DECIMAL(12, 3) NOT NULL,
    `reference_type` VARCHAR(50) NOT NULL,
    `reference_id` BIGINT UNSIGNED NOT NULL,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_movements_batch_id_idx`(`batch_id`),
    INDEX `stock_movements_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_adjustments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `adjustment_number` VARCHAR(50) NOT NULL,
    `reason` ENUM('PHYSICAL_COUNT_VARIANCE', 'DAMAGED_IN_STORE', 'EXPIRED_DISPOSAL', 'THEFT_OR_LOSS') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_by` BIGINT UNSIGNED NOT NULL,
    `approved_by` BIGINT UNSIGNED NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_adjustments_adjustment_number_key`(`adjustment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_adjustment_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `adjustment_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `system_quantity` DECIMAL(12, 3) NOT NULL,
    `physical_quantity` DECIMAL(12, 3) NOT NULL,
    `variance` DECIMAL(12, 3) NOT NULL,
    `unit_cost_snapshot` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `contact_person` VARCHAR(100) NULL,
    `phone` VARCHAR(50) NOT NULL,
    `email` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `payment_terms` VARCHAR(100) NULL,
    `credit_limit` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `current_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `suppliers_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `purchase_number` VARCHAR(50) NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `supplier_invoice_no` VARCHAR(100) NULL,
    `status` ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `received_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchases_purchase_number_key`(`purchase_number`),
    INDEX `purchases_supplier_id_idx`(`supplier_id`),
    INDEX `purchases_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `purchase_id` BIGINT UNSIGNED NOT NULL,
    `medicine_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NULL,
    `batch_number` VARCHAR(100) NOT NULL,
    `expiry_date` DATE NOT NULL,
    `ordered_quantity` DECIMAL(12, 3) NOT NULL,
    `received_quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `bonus_quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    `selling_price` DECIMAL(12, 2) NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `payment_number` VARCHAR(50) NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `purchase_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER') NOT NULL,
    `payment_reference` VARCHAR(100) NULL,
    `paid_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` BIGINT UNSIGNED NOT NULL,

    UNIQUE INDEX `supplier_payments_payment_number_key`(`payment_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_returns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `return_number` VARCHAR(50) NOT NULL,
    `supplier_id` BIGINT UNSIGNED NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `purchase_returns_return_number_key`(`return_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_return_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `purchase_return_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `return_quantity` DECIMAL(12, 3) NOT NULL,
    `unit_cost` DECIMAL(12, 2) NOT NULL,
    `line_total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `email` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `whatsapp_consent` BOOLEAN NOT NULL DEFAULT false,
    `consent_at` DATETIME(3) NULL,
    `outstanding_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_phone_key`(`phone`),
    INDEX `customers_phone_idx`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `patients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT UNSIGNED NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `age` INTEGER UNSIGNED NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `known_allergies` TEXT NULL,
    `chronic_conditions` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescriptions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `prescription_code` VARCHAR(50) NOT NULL,
    `patient_id` BIGINT UNSIGNED NOT NULL,
    `doctor_name` VARCHAR(150) NOT NULL,
    `doctor_slmc_no` VARCHAR(50) NULL,
    `prescription_date` DATE NOT NULL,
    `image_attachment_url` VARCHAR(255) NULL,
    `status` ENUM('PENDING_REVIEW', 'VERIFIED', 'PARTIALLY_DISPENSED', 'DISPENSED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `total_refills` INTEGER UNSIGNED NOT NULL DEFAULT 1,
    `dispensed_refills` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `clinical_notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `prescriptions_prescription_code_key`(`prescription_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `opening_float` DECIMAL(12, 2) NOT NULL,
    `closing_amount` DECIMAL(12, 2) NULL,
    `expected_amount` DECIMAL(12, 2) NULL,
    `variance` DECIMAL(12, 2) NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `notes` TEXT NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,

    INDEX `cash_sessions_user_id_status_idx`(`user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `invoice_number` VARCHAR(50) NOT NULL,
    `idempotency_key` VARCHAR(64) NOT NULL,
    `cash_session_id` BIGINT UNSIGNED NOT NULL,
    `customer_id` BIGINT UNSIGNED NULL,
    `prescription_id` BIGINT UNSIGNED NULL,
    `cashier_id` BIGINT UNSIGNED NOT NULL,
    `status` ENUM('COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `grand_total` DECIMAL(12, 2) NOT NULL,
    `amount_paid` DECIMAL(12, 2) NOT NULL,
    `change_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `reprint_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sales_invoice_number_key`(`invoice_number`),
    UNIQUE INDEX `sales_idempotency_key_key`(`idempotency_key`),
    INDEX `sales_invoice_number_idx`(`invoice_number`),
    INDEX `sales_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `medicine_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `unit_id` BIGINT UNSIGNED NULL,
    `quantity` DECIMAL(12, 3) NOT NULL,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `unit_cost_snapshot` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `line_total` DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `payment_method` ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'LANKAPAY_QR', 'BANK_TRANSFER', 'STORE_CREDIT') NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `reference_code` VARCHAR(100) NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'SUCCESS',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_returns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `return_number` VARCHAR(50) NOT NULL,
    `sale_id` BIGINT UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `refund_total` DECIMAL(12, 2) NOT NULL,
    `refund_method` ENUM('CASH', 'STORE_CREDIT') NOT NULL,
    `processed_by` BIGINT UNSIGNED NOT NULL,
    `approved_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sales_returns_return_number_key`(`return_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales_return_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `sales_return_id` BIGINT UNSIGNED NOT NULL,
    `sale_item_id` BIGINT UNSIGNED NOT NULL,
    `batch_id` BIGINT UNSIGNED NOT NULL,
    `return_quantity` DECIMAL(12, 3) NOT NULL,
    `refund_amount` DECIMAL(12, 2) NOT NULL,
    `restock_status` ENUM('RESTOCKED', 'QUARANTINED', 'DISCARDED') NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expense_categories` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `expense_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_id` BIGINT UNSIGNED NOT NULL,
    `cash_session_id` BIGINT UNSIGNED NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `voucher_attachment_url` VARCHAR(255) NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `expense_date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `customer_id` BIGINT UNSIGNED NULL,
    `channel` ENUM('WHATSAPP', 'SMS', 'EMAIL') NOT NULL DEFAULT 'WHATSAPP',
    `recipient_phone` VARCHAR(30) NOT NULL,
    `template_name` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `provider_message_id` VARCHAR(150) NULL,
    `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_logs_provider_message_id_idx`(`provider_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pharmacy_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pharmacy_settings_setting_key_key`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicines` ADD CONSTRAINT `medicines_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicines` ADD CONSTRAINT `medicines_manufacturer_id_fkey` FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicines` ADD CONSTRAINT `medicines_generic_id_fkey` FOREIGN KEY (`generic_id`) REFERENCES `generic_molecules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_units` ADD CONSTRAINT `medicine_units_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicine_batches` ADD CONSTRAINT `medicine_batches_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_adjustment_id_fkey` FOREIGN KEY (`adjustment_id`) REFERENCES `stock_adjustments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_adjustment_items` ADD CONSTRAINT `stock_adjustment_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_return_items` ADD CONSTRAINT `purchase_return_items_purchase_return_id_fkey` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `patients` ADD CONSTRAINT `patients_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescriptions` ADD CONSTRAINT `prescriptions_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_sessions` ADD CONSTRAINT `cash_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_cash_session_id_fkey` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_prescription_id_fkey` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashier_id_fkey` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_medicine_id_fkey` FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `medicine_units`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_processed_by_fkey` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_sales_return_id_fkey` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_sale_item_id_fkey` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `medicine_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_cash_session_id_fkey` FOREIGN KEY (`cash_session_id`) REFERENCES `cash_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
