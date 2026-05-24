import { relations } from "drizzle-orm";
import {
  mysqlTable,
  mysqlEnum,
  varchar,
  text,
  int,
  tinyint,
  boolean,
  decimal,
  timestamp,
  json,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { user } from "./auth-schema.ts";

// ─── Enum Types ───────────────────────────────────────────────────────────────

export const variantTypeEnum = mysqlEnum("variant_type", [
  "size",
  "weight",
  "flavor",
  "tier",
]);

export const addressTypeEnum = mysqlEnum("address_type", [
  "home",
  "office",
  "other",
]);

export const orderStatusEnum = mysqlEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatusEnum = mysqlEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const paymentMethodEnum = mysqlEnum("payment_method", [
  "cod",
  "upi",
  "card",
  "netbanking",
  "wallet",
]);

export const uploadStatusEnum = mysqlEnum("upload_status", [
  "pending",
  "completed",
  "failed",
]);

// ─── Category ─────────────────────────────────────────────────────────────────

export const category = mysqlTable(
  "category",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    imageUrl: text("image_url"),
    // self-referential for subcategories (e.g. Cakes → Birthday Cakes)
    parentId: varchar("parent_id", { length: 36 }),
    sortOrder: int("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("category_slug_idx").on(table.slug),
    index("category_parent_idx").on(table.parentId),
    index("category_sort_idx").on(table.sortOrder),
  ],
);

// ─── Cake ─────────────────────────────────────────────────────────────────────

export const cake = mysqlTable(
  "cake",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 280 }).notNull().unique(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    categoryId: varchar("category_id", { length: 36 }).references(
      () => category.id,
      { onDelete: "restrict" },
    ),
    basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
    // display flags
    isFeatured: boolean("is_featured").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    isBestseller: boolean("is_bestseller").default(false).notNull(),
    // SEO
    metaTitle: varchar("meta_title", { length: 255 }),
    metaDescription: varchar("meta_description", { length: 500 }),
    // denormalized aggregates — updated on every review change
    avgRating: decimal("avg_rating", { precision: 3, scale: 2 })
      .default("0.00")
      .notNull(),
    reviewCount: int("review_count").default(0).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cake_category_idx").on(table.categoryId),
    index("cake_slug_idx").on(table.slug),
    index("cake_featured_idx").on(table.isFeatured),
    index("cake_active_idx").on(table.isActive),
    index("cake_price_idx").on(table.basePrice),
  ],
);

// ─── Cake Image ───────────────────────────────────────────────────────────────

export const cakeImage = mysqlTable(
  "cake_image",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    // Cloudinary public_id — used for deletion
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    altText: varchar("alt_text", { length: 255 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    sortOrder: int("sort_order").default(0).notNull(),
    width: int("width"),
    height: int("height"),
    sizeBytes: int("size_bytes"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("cake_image_cake_idx").on(table.cakeId),
    index("cake_image_primary_idx").on(table.cakeId, table.isPrimary),
  ],
);

// ─── Cake Variant ─────────────────────────────────────────────────────────────

export const cakeVariant = mysqlTable(
  "cake_variant",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    // "size" | "weight" | "flavor" | "tier"
    variantType: variantTypeEnum.notNull(),
    // e.g. "1 kg", "Chocolate", "Round 8-inch", "2 Tier"
    name: varchar("name", { length: 100 }).notNull(),
    // added to cake.basePrice — can be negative for cheaper variants
    priceModifier: decimal("price_modifier", { precision: 10, scale: 2 })
      .default("0.00")
      .notNull(),
    stockQty: int("stock_qty").default(0).notNull(),
    sku: varchar("sku", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: int("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("variant_cake_idx").on(table.cakeId),
    index("variant_type_idx").on(table.cakeId, table.variantType),
    index("variant_sku_idx").on(table.sku),
  ],
);

// ─── Tag + Cake Tag (many-to-many) ────────────────────────────────────────────

export const tag = mysqlTable(
  "tag",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 80 }).notNull().unique(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
  },
  (table) => [index("tag_slug_idx").on(table.slug)],
);

export const cakeTag = mysqlTable(
  "cake_tag",
  {
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 36 })
      .notNull()
      .references(() => tag.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cakeId, table.tagId] })],
);

// ─── Upload (image tracking) ──────────────────────────────────────────────────

export const upload = mysqlTable(
  "upload",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uploadedBy: varchar("uploaded_by", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    // Cloudinary public_id (used for deletion)
    storageKey: varchar("storage_key", { length: 512 }).notNull().unique(),
    publicUrl: text("public_url").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    mimeType: varchar("mime_type", { length: 50 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    status: uploadStatusEnum.default("completed").notNull(),
    // which entity uses this image
    linkedEntityType: varchar("linked_entity_type", { length: 50 }), // "cake" | "category"
    linkedEntityId: varchar("linked_entity_id", { length: 36 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("upload_uploader_idx").on(table.uploadedBy),
    index("upload_entity_idx").on(table.linkedEntityType, table.linkedEntityId),
  ],
);

// ─── Address ──────────────────────────────────────────────────────────────────

export const address = mysqlTable(
  "address",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }), // "Home", "Mom's place", etc.
    addressType: addressTypeEnum.default("home").notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    line1: varchar("line1", { length: 255 }).notNull(),
    line2: varchar("line2", { length: 255 }),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    pincode: varchar("pincode", { length: 10 }).notNull(),
    country: varchar("country", { length: 60 }).default("India").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("address_user_idx").on(table.userId),
    index("address_default_idx").on(table.userId, table.isDefault),
  ],
);

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const cart = mysqlTable("cart", {
  id: varchar("id", { length: 36 }).primaryKey(),
  // one cart per user — enforced by UNIQUE
  userId: varchar("user_id", { length: 36 })
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // denormalized — recalculated on every item change
  subtotal: decimal("subtotal", { precision: 10, scale: 2 })
    .default("0.00")
    .notNull(),
  createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { fsp: 3 })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const cartItem = mysqlTable(
  "cart_item",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cartId: varchar("cart_id", { length: 36 })
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    variantId: varchar("variant_id", { length: 36 }).references(
      () => cakeVariant.id,
      { onDelete: "set null" },
    ),
    quantity: int("quantity").default(1).notNull(),
    // price snapshot — locked at time of add, survives admin price changes
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    // e.g. "Happy Birthday Rahul! 🎂"
    customMessage: varchar("custom_message", { length: 300 }),
    deliveryDate: timestamp("delivery_date", { fsp: 0 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("cart_item_cart_idx").on(table.cartId),
    index("cart_item_cake_idx").on(table.cakeId),
    // prevents duplicate cake+variant rows in the same cart
    uniqueIndex("cart_item_unique_idx").on(
      table.cartId,
      table.cakeId,
      table.variantId,
    ),
  ],
);

// ─── Order ────────────────────────────────────────────────────────────────────

export const order = mysqlTable(
  "order",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    // human-readable: ORD-20260524-A7X2K9
    orderNumber: varchar("order_number", { length: 30 }).notNull().unique(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: orderStatusEnum.default("pending").notNull(),
    paymentStatus: paymentStatusEnum.default("pending").notNull(),
    paymentMethod: paymentMethodEnum,
    // Razorpay order_id or payment_id
    paymentTransactionId: varchar("payment_transaction_id", { length: 255 }),

    // FK kept for reference; full snapshot stored in shippingSnapshot JSON
    shippingAddressId: varchar("shipping_address_id", {
      length: 36,
    }).references(() => address.id, { onDelete: "set null" }),
    // full address JSON captured at order time — survives address deletion
    shippingSnapshot: json("shipping_snapshot"),

    // pricing
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 })
      .default("0.00")
      .notNull(),
    totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),

    // requested delivery
    deliveryDate: timestamp("delivery_date", { fsp: 0 }),
    deliveryTimeSlot: varchar("delivery_time_slot", { length: 50 }), // "10:00-12:00"

    // notes
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),

    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("order_user_idx").on(table.userId),
    index("order_number_idx").on(table.orderNumber),
    index("order_status_idx").on(table.status),
    index("order_payment_status_idx").on(table.paymentStatus),
    index("order_created_idx").on(table.createdAt),
    index("order_delivery_idx").on(table.deliveryDate),
  ],
);

// ─── Order Item ───────────────────────────────────────────────────────────────

export const orderItem = mysqlTable(
  "order_item",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 })
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    // nullable — in case the cake/variant is deleted later
    cakeId: varchar("cake_id", { length: 36 }).references(() => cake.id, {
      onDelete: "set null",
    }),
    variantId: varchar("variant_id", { length: 36 }).references(
      () => cakeVariant.id,
      { onDelete: "set null" },
    ),
    // snapshots — order history is stable even after product edits
    cakeName: varchar("cake_name", { length: 255 }).notNull(),
    variantName: varchar("variant_name", { length: 100 }),
    imageUrl: text("image_url"),

    quantity: int("quantity").notNull(),
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
    customMessage: varchar("custom_message", { length: 300 }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    index("order_item_order_idx").on(table.orderId),
    index("order_item_cake_idx").on(table.cakeId),
  ],
);

// ─── Order Status History ─────────────────────────────────────────────────────

export const orderStatusHistory = mysqlTable(
  "order_status_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    orderId: varchar("order_id", { length: 36 })
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    status: orderStatusEnum.notNull(),
    // e.g. "Cake is being baked", "Out for delivery via Swiggy"
    note: text("note"),
    // which admin/system triggered the change
    changedBy: varchar("changed_by", { length: 36 }).references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [index("status_history_order_idx").on(table.orderId)],
);

// ─── Review ───────────────────────────────────────────────────────────────────

export const review = mysqlTable(
  "review",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // ties review to a specific purchase — used for verified purchase badge
    orderId: varchar("order_id", { length: 36 }).references(() => order.id, {
      onDelete: "set null",
    }),
    rating: tinyint("rating").notNull(), // 1–5
    title: varchar("title", { length: 200 }),
    body: text("body"),
    isVerifiedPurchase: boolean("is_verified_purchase")
      .default(false)
      .notNull(),
    // admin must approve before showing publicly
    isApproved: boolean("is_approved").default(false).notNull(),
    adminReply: text("admin_reply"),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("review_cake_idx").on(table.cakeId),
    index("review_user_idx").on(table.userId),
    index("review_approved_idx").on(table.isApproved),
    // one review per user per cake
    uniqueIndex("review_user_cake_unique_idx").on(table.userId, table.cakeId),
  ],
);

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export const wishlist = mysqlTable(
  "wishlist",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: varchar("user_id", { length: 36 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    cakeId: varchar("cake_id", { length: 36 })
      .notNull()
      .references(() => cake.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wishlist_user_cake_unique_idx").on(table.userId, table.cakeId),
    index("wishlist_user_idx").on(table.userId),
  ],
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "subcategories",
  }),
  children: many(category, { relationName: "subcategories" }),
  cakes: many(cake),
}));

export const cakeRelations = relations(cake, ({ one, many }) => ({
  category: one(category, {
    fields: [cake.categoryId],
    references: [category.id],
  }),
  images: many(cakeImage),
  variants: many(cakeVariant),
  tags: many(cakeTag),
  reviews: many(review),
  wishlistedBy: many(wishlist),
  cartItems: many(cartItem),
  orderItems: many(orderItem),
}));

export const cakeImageRelations = relations(cakeImage, ({ one }) => ({
  cake: one(cake, { fields: [cakeImage.cakeId], references: [cake.id] }),
}));

export const cakeVariantRelations = relations(cakeVariant, ({ one, many }) => ({
  cake: one(cake, { fields: [cakeVariant.cakeId], references: [cake.id] }),
  cartItems: many(cartItem),
  orderItems: many(orderItem),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  cakes: many(cakeTag),
}));

export const cakeTagRelations = relations(cakeTag, ({ one }) => ({
  cake: one(cake, { fields: [cakeTag.cakeId], references: [cake.id] }),
  tag: one(tag, { fields: [cakeTag.tagId], references: [tag.id] }),
}));

export const uploadRelations = relations(upload, ({ one }) => ({
  uploader: one(user, { fields: [upload.uploadedBy], references: [user.id] }),
}));

export const addressRelations = relations(address, ({ one, many }) => ({
  user: one(user, { fields: [address.userId], references: [user.id] }),
  orders: many(order),
}));

export const cartRelations = relations(cart, ({ one, many }) => ({
  user: one(user, { fields: [cart.userId], references: [user.id] }),
  items: many(cartItem),
}));

export const cartItemRelations = relations(cartItem, ({ one }) => ({
  cart: one(cart, { fields: [cartItem.cartId], references: [cart.id] }),
  cake: one(cake, { fields: [cartItem.cakeId], references: [cake.id] }),
  variant: one(cakeVariant, {
    fields: [cartItem.variantId],
    references: [cakeVariant.id],
  }),
}));

export const orderRelations = relations(order, ({ one, many }) => ({
  user: one(user, { fields: [order.userId], references: [user.id] }),
  shippingAddress: one(address, {
    fields: [order.shippingAddressId],
    references: [address.id],
  }),
  items: many(orderItem),
  statusHistory: many(orderStatusHistory),
  reviews: many(review),
}));

export const orderItemRelations = relations(orderItem, ({ one }) => ({
  order: one(order, { fields: [orderItem.orderId], references: [order.id] }),
  cake: one(cake, { fields: [orderItem.cakeId], references: [cake.id] }),
  variant: one(cakeVariant, {
    fields: [orderItem.variantId],
    references: [cakeVariant.id],
  }),
}));

export const orderStatusHistoryRelations = relations(
  orderStatusHistory,
  ({ one }) => ({
    order: one(order, {
      fields: [orderStatusHistory.orderId],
      references: [order.id],
    }),
    changedByUser: one(user, {
      fields: [orderStatusHistory.changedBy],
      references: [user.id],
    }),
  }),
);

export const reviewRelations = relations(review, ({ one }) => ({
  cake: one(cake, { fields: [review.cakeId], references: [cake.id] }),
  user: one(user, { fields: [review.userId], references: [user.id] }),
  order: one(order, { fields: [review.orderId], references: [order.id] }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(user, { fields: [wishlist.userId], references: [user.id] }),
  cake: one(cake, { fields: [wishlist.cakeId], references: [cake.id] }),
}));
