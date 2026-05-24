CREATE TABLE `address` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`label` varchar(80),
	`address_type` enum('home','office','other') NOT NULL DEFAULT 'home',
	`full_name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`line1` varchar(255) NOT NULL,
	`line2` varchar(255),
	`city` varchar(100) NOT NULL,
	`state` varchar(100) NOT NULL,
	`pincode` varchar(10) NOT NULL,
	`country` varchar(60) NOT NULL DEFAULT 'India',
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `address_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cake` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(280) NOT NULL,
	`description` text,
	`short_description` varchar(500),
	`category_id` varchar(36),
	`base_price` decimal(10,2) NOT NULL,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_bestseller` boolean NOT NULL DEFAULT false,
	`meta_title` varchar(255),
	`meta_description` varchar(500),
	`avg_rating` decimal(3,2) NOT NULL DEFAULT '0.00',
	`review_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `cake_id` PRIMARY KEY(`id`),
	CONSTRAINT `cake_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cake_image` (
	`id` varchar(36) NOT NULL,
	`cake_id` varchar(36) NOT NULL,
	`url` text NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`alt_text` varchar(255),
	`is_primary` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`width` int,
	`height` int,
	`size_bytes` int,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `cake_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cake_tag` (
	`cake_id` varchar(36) NOT NULL,
	`tag_id` varchar(36) NOT NULL,
	CONSTRAINT `cake_tag_cake_id_tag_id_pk` PRIMARY KEY(`cake_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `cake_variant` (
	`id` varchar(36) NOT NULL,
	`cake_id` varchar(36) NOT NULL,
	`variant_type` enum('size','weight','flavor','tier') NOT NULL,
	`name` varchar(100) NOT NULL,
	`price_modifier` decimal(10,2) NOT NULL DEFAULT '0.00',
	`stock_qty` int NOT NULL DEFAULT 0,
	`sku` varchar(100),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `cake_variant_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`subtotal` decimal(10,2) NOT NULL DEFAULT '0.00',
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `cart_item` (
	`id` varchar(36) NOT NULL,
	`cart_id` varchar(36) NOT NULL,
	`cake_id` varchar(36) NOT NULL,
	`variant_id` varchar(36),
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` decimal(10,2) NOT NULL,
	`custom_message` varchar(300),
	`delivery_date` timestamp(0),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `cart_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `cart_item_unique_idx` UNIQUE(`cart_id`,`cake_id`,`variant_id`)
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` varchar(36) NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`image_url` text,
	`parent_id` varchar(36),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `category_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `order` (
	`id` varchar(36) NOT NULL,
	`order_number` varchar(30) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`order_status` enum('pending','confirmed','preparing','ready','out_for_delivery','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`payment_status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`payment_method` enum('cod','upi','card','netbanking','wallet'),
	`payment_transaction_id` varchar(255),
	`shipping_address_id` varchar(36),
	`shipping_snapshot` json,
	`subtotal` decimal(10,2) NOT NULL,
	`delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
	`total_amount` decimal(10,2) NOT NULL,
	`delivery_date` timestamp(0),
	`delivery_time_slot` varchar(50),
	`customer_note` text,
	`admin_note` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `order_id` PRIMARY KEY(`id`),
	CONSTRAINT `order_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`cake_id` varchar(36),
	`variant_id` varchar(36),
	`cake_name` varchar(255) NOT NULL,
	`variant_name` varchar(100),
	`image_url` text,
	`quantity` int NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`line_total` decimal(10,2) NOT NULL,
	`custom_message` varchar(300),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `order_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`order_status` enum('pending','confirmed','preparing','ready','out_for_delivery','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`note` text,
	`changed_by` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `order_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `review` (
	`id` varchar(36) NOT NULL,
	`cake_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`rating` tinyint NOT NULL,
	`title` varchar(200),
	`body` text,
	`is_verified_purchase` boolean NOT NULL DEFAULT false,
	`is_approved` boolean NOT NULL DEFAULT false,
	`admin_reply` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `review_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_user_cake_unique_idx` UNIQUE(`user_id`,`cake_id`)
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` varchar(36) NOT NULL,
	`name` varchar(80) NOT NULL,
	`slug` varchar(100) NOT NULL,
	CONSTRAINT `tag_id` PRIMARY KEY(`id`),
	CONSTRAINT `tag_name_unique` UNIQUE(`name`),
	CONSTRAINT `tag_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `upload` (
	`id` varchar(36) NOT NULL,
	`uploaded_by` varchar(36) NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`public_url` text NOT NULL,
	`original_filename` varchar(255),
	`mime_type` varchar(50) NOT NULL,
	`size_bytes` int NOT NULL,
	`upload_status` enum('pending','completed','failed') NOT NULL DEFAULT 'completed',
	`linked_entity_type` varchar(50),
	`linked_entity_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `upload_id` PRIMARY KEY(`id`),
	CONSTRAINT `upload_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `wishlist` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`cake_id` varchar(36) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `wishlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `wishlist_user_cake_unique_idx` UNIQUE(`user_id`,`cake_id`)
);
--> statement-breakpoint
ALTER TABLE `user` ADD `role` varchar(50) DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `user` ADD `banned` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` timestamp(3);--> statement-breakpoint
ALTER TABLE `address` ADD CONSTRAINT `address_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cake` ADD CONSTRAINT `cake_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cake_image` ADD CONSTRAINT `cake_image_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cake_tag` ADD CONSTRAINT `cake_tag_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cake_tag` ADD CONSTRAINT `cake_tag_tag_id_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cake_variant` ADD CONSTRAINT `cake_variant_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart` ADD CONSTRAINT `cart_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_cart_id_cart_id_fk` FOREIGN KEY (`cart_id`) REFERENCES `cart`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_item` ADD CONSTRAINT `cart_item_variant_id_cake_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `cake_variant`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order` ADD CONSTRAINT `order_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order` ADD CONSTRAINT `order_shipping_address_id_address_id_fk` FOREIGN KEY (`shipping_address_id`) REFERENCES `address`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_order_id_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_variant_id_cake_variant_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `cake_variant`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_order_id_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_changed_by_user_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review` ADD CONSTRAINT `review_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review` ADD CONSTRAINT `review_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review` ADD CONSTRAINT `review_order_id_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `order`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `upload` ADD CONSTRAINT `upload_uploaded_by_user_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wishlist` ADD CONSTRAINT `wishlist_cake_id_cake_id_fk` FOREIGN KEY (`cake_id`) REFERENCES `cake`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `address_user_idx` ON `address` (`user_id`);--> statement-breakpoint
CREATE INDEX `address_default_idx` ON `address` (`user_id`,`is_default`);--> statement-breakpoint
CREATE INDEX `cake_category_idx` ON `cake` (`category_id`);--> statement-breakpoint
CREATE INDEX `cake_slug_idx` ON `cake` (`slug`);--> statement-breakpoint
CREATE INDEX `cake_featured_idx` ON `cake` (`is_featured`);--> statement-breakpoint
CREATE INDEX `cake_active_idx` ON `cake` (`is_active`);--> statement-breakpoint
CREATE INDEX `cake_price_idx` ON `cake` (`base_price`);--> statement-breakpoint
CREATE INDEX `cake_image_cake_idx` ON `cake_image` (`cake_id`);--> statement-breakpoint
CREATE INDEX `cake_image_primary_idx` ON `cake_image` (`cake_id`,`is_primary`);--> statement-breakpoint
CREATE INDEX `variant_cake_idx` ON `cake_variant` (`cake_id`);--> statement-breakpoint
CREATE INDEX `variant_type_idx` ON `cake_variant` (`cake_id`,`variant_type`);--> statement-breakpoint
CREATE INDEX `variant_sku_idx` ON `cake_variant` (`sku`);--> statement-breakpoint
CREATE INDEX `cart_item_cart_idx` ON `cart_item` (`cart_id`);--> statement-breakpoint
CREATE INDEX `cart_item_cake_idx` ON `cart_item` (`cake_id`);--> statement-breakpoint
CREATE INDEX `category_slug_idx` ON `category` (`slug`);--> statement-breakpoint
CREATE INDEX `category_parent_idx` ON `category` (`parent_id`);--> statement-breakpoint
CREATE INDEX `category_sort_idx` ON `category` (`sort_order`);--> statement-breakpoint
CREATE INDEX `order_user_idx` ON `order` (`user_id`);--> statement-breakpoint
CREATE INDEX `order_number_idx` ON `order` (`order_number`);--> statement-breakpoint
CREATE INDEX `order_status_idx` ON `order` (`order_status`);--> statement-breakpoint
CREATE INDEX `order_payment_status_idx` ON `order` (`payment_status`);--> statement-breakpoint
CREATE INDEX `order_created_idx` ON `order` (`created_at`);--> statement-breakpoint
CREATE INDEX `order_delivery_idx` ON `order` (`delivery_date`);--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_item_cake_idx` ON `order_item` (`cake_id`);--> statement-breakpoint
CREATE INDEX `status_history_order_idx` ON `order_status_history` (`order_id`);--> statement-breakpoint
CREATE INDEX `review_cake_idx` ON `review` (`cake_id`);--> statement-breakpoint
CREATE INDEX `review_user_idx` ON `review` (`user_id`);--> statement-breakpoint
CREATE INDEX `review_approved_idx` ON `review` (`is_approved`);--> statement-breakpoint
CREATE INDEX `tag_slug_idx` ON `tag` (`slug`);--> statement-breakpoint
CREATE INDEX `upload_uploader_idx` ON `upload` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `upload_entity_idx` ON `upload` (`linked_entity_type`,`linked_entity_id`);--> statement-breakpoint
CREATE INDEX `wishlist_user_idx` ON `wishlist` (`user_id`);