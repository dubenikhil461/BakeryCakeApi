# 🎂 BakeryCake — Admin & User Guide

A full-stack homemade eggless bakery platform.  
**Backend:** Hono + Drizzle ORM + PostgreSQL (Bun runtime)  
**Frontend:** Nuxt 3 + Tailwind CSS (prefixed `tw:`)

---

## Table of Contents

1. [How the App Works](#how-the-app-works)
2. [Admin Guide](#admin-guide)
   - [Logging In as Admin](#logging-in-as-admin)
   - [Managing Cakes](#managing-cakes)
   - [Managing Categories](#managing-categories)
   - [Managing Orders](#managing-orders)
   - [Managing Reviews](#managing-reviews)
   - [Managing Users](#managing-users)
3. [User Guide](#user-guide)
   - [Browsing Cakes](#browsing-cakes)
   - [Creating an Account](#creating-an-account)
   - [Adding to Cart & Checkout](#adding-to-cart--checkout)
   - [Tracking Orders](#tracking-orders)
   - [Wishlist](#wishlist)
   - [Writing a Review](#writing-a-review)
   - [Managing Addresses](#managing-addresses)
4. [Home Page Catalog vs Browse Page](#home-page-catalog-vs-browse-page)
5. [Running Locally](#running-locally)

---

## How the App Works

The platform has two surfaces:

| Surface | URL | What it shows |
|---|---|---|
| **Home page catalog** | `/` | A **static price list** from `app/data/catalog.ts` — always visible, no login needed |
| **Browse & Order** | `/cakes` | **Dynamic cakes** added by admin — with images, variants, cart & checkout |
| **Admin panel** | `/admin` | Full management of cakes, categories, orders, reviews, users |

> **Key rule:** The home page catalog is a static menu (names + prices). When the admin adds a cake through the admin panel it appears on the **Browse & Order** page (`/cakes`), not the home catalog. To update the home catalog price list, edit `bakerycakeapp/app/data/catalog.ts`.

---

## Admin Guide

### Logging In as Admin

1. Go to `/auth` and sign in with your email (OTP-based, no password needed).
2. Your account must have `role = admin` in the database. Ask the developer to set this.
3. Once signed in, an **Admin** link appears in the header. Or go directly to `/admin`.

---

### Managing Cakes

**Path:** `/admin/cakes`

These are the cakes that appear on the **Browse & Order** page (`/cakes`) with images, variants, and an Add to Cart button.

#### Creating a New Cake

1. Click **+ New Cake**.
2. Fill in the form:

   | Field | Required | Notes |
   |---|---|---|
   | **Name** | ✅ | The cake's display name |
   | **Base Price (₹)** | ✅ | Price for the default size/weight |
   | **Slug** | ❌ | Auto-generated from name — leave blank |
   | **Category** | ❌ | Pick from categories you've created |
   | **Short Description** | ❌ | Shown on listing cards (max 300 chars) |
   | **Description** | ❌ | Full description on the cake detail page |
   | **Meta Title / Meta Description** | ❌ | For SEO |
   | **Active** | ✅ | Must be checked for the cake to appear on `/cakes` |

3. Click **Create Cake**. You'll be redirected to the cake's edit page.
4. **Upload images** — click `+ Upload` in the Images section. The first image automatically becomes the primary (shown on listing cards).
5. **Add variants** — click `+ Add Variant` to add size/weight/flavour options with price modifiers.

#### Editing a Cake

1. From the cakes list, click **Edit** on any row.
2. Update any field and click **Save Changes**.
3. To hide a cake from `/cakes`, uncheck **Active** and save — or click **Deactivate** from the list.

#### Adding Variants (Sizes / Weights / Flavours)

After the cake is created:

1. Scroll to the **Variants** section.
2. Click **+ Add Variant**.
3. Fill in:

   | Field | Notes |
   |---|---|
   | **Type** | `size`, `weight`, `flavor`, or `tier` |
   | **Name** | e.g. "1 Kg", "2 Kg", "Chocolate" |
   | **Price Modifier (₹)** | Added to base price. Use negative for a discount. |
   | **Stock Qty** | `0` = out of stock |
   | **SKU** | Optional internal reference code |
   | **Active** | Uncheck to hide this variant without deleting it |

4. Click **Save**.

#### Managing Images

- **Upload** → click `+ Upload` → pick a JPG/PNG/WebP file.
- **Set Primary** → hover an image → click **Set Primary**. Primary image shows on listing cards.
- **Remove** → hover an image → click **Remove**. The file is also deleted from Cloudinary.

---

### Managing Categories

**Path:** `/admin/categories`

Categories appear in the filter sidebar on the Browse Cakes page and on each cake card.

1. Click **+ New Category** to create one.
2. Fields: **Name**, **Slug** (auto), **Description**, **Image**, **Active**, **Sort Order**.
3. Categories can be nested — set a **Parent Category** to create sub-categories.
4. Click **Save**. The category is immediately available when creating/editing cakes.

---

### Managing Orders

**Path:** `/admin/orders`

#### Order Status Flow

```
pending → confirmed → preparing → ready → out_for_delivery → delivered
                                                            ↘ cancelled / refunded
```

| Status | Meaning |
|---|---|
| `pending` | Order placed, awaiting admin confirmation |
| `confirmed` | Admin confirmed |
| `preparing` | Being baked/prepared |
| `ready` | Ready for pickup or delivery |
| `out_for_delivery` | Driver on the way |
| `delivered` | Successfully delivered |
| `cancelled` | Cancelled by admin or customer |
| `refunded` | Payment refunded |

#### Updating an Order

1. Click on any order row to open the detail page.
2. Use the **Update Status** dropdown and click **Save**.
3. Add an optional **admin note** for internal reference.
4. **Payment status** (`pending`, `paid`, `failed`, `refunded`) can be updated separately.

---

### Managing Reviews

**Path:** `/admin/reviews`

All reviews submitted by users land here for moderation.

- **Approve** — makes the review visible on the public cake page and updates the star rating.
- **Reject / Delete** — removes the review from the public page.
- **Reply** — your reply is shown publicly below the review on the cake page.

> A cake's star rating and review count auto-recalculate whenever a review is approved or removed.

---

### Managing Users

**Path:** `/admin/users`

- View all registered users with email, role, and join date.
- **Ban** a user (temporarily or permanently) — banned users cannot sign in or place orders.
- **Unban** a user to restore access.

---

## User Guide

### Browsing Cakes

1. Go to `/cakes` or click **Browse & Order Online** on the home page.
2. Use the **filter sidebar** to narrow results:
   - **Category** — e.g. Fruit Delight, Chocolate
   - **Price range** — set a minimum and/or maximum
   - **Sort** — newest, price low→high, price high→low, top rated
   - **Search** — type part of a cake name
3. Click any cake card to open the full detail page — images, description, variants, and customer reviews.

---

### Creating an Account

1. Click **Sign In** in the header (or go to `/auth`).
2. Enter your **email address**.
3. Check your inbox for a **6-digit OTP** and enter it on the page.
4. You're signed in — no password required. Each login sends a fresh OTP.

---

### Adding to Cart & Checkout

1. On a cake's detail page, pick a **variant** (size/weight/flavour) if available.
2. Click **Add to Cart** — or use the quick-add button on listing cards.
3. Open the **Cart** from the header icon or go to `/cart`.
4. In the cart you can:
   - Change **quantities**
   - Add a **custom message** (e.g. "Happy Birthday Priya!" to be written on the cake)
   - Set a **preferred delivery date**
   - Remove items
5. Click **Proceed to Checkout**.
6. Select a saved **delivery address** or add a new one.
7. Choose a **payment method**:
   - **Cash on Delivery (COD)** — pay when the cake arrives.
   - **Online (Razorpay)** — pay now by UPI, card, or netbanking.
8. Click **Place Order**. You'll see your order number immediately.

---

### Tracking Orders

1. Go to `/orders` (or click your name → **My Orders**).
2. See all past and current orders with status badges.
3. Click any order to see: items ordered, delivery address, full status history, and payment details.

---

### Wishlist

1. Click the **🤍 heart** on any cake card to save it.
2. Go to `/wishlist` to view all saved cakes.
3. Click the heart again to remove it from the wishlist.
4. A wishlist requires you to be signed in.

---

### Writing a Review

1. You must be **signed in** and have a **delivered** order containing that cake.
2. Go to the cake's detail page (`/cakes/<slug>`).
3. Scroll to the **Reviews** section and click **Write a Review**.
4. Give a **star rating** (1–5), an optional **title**, and your **review body**.
5. Submit — your review goes live after admin approval.

---

### Managing Addresses

1. Go to `/addresses` (or via the account menu).
2. Click **+ Add Address** and fill in: Full Name, Phone, Address Line 1 & 2, City, State, Pincode.
3. Mark one address as **Default** — it's pre-selected at checkout.
4. Edit or delete addresses at any time.

---

## Home Page Catalog vs Browse Page

| | Home Catalog (`/`) | Browse & Order (`/cakes`) |
|---|---|---|
| **Data source** | `app/data/catalog.ts` (static file) | Database via Admin Panel |
| **How to update** | Edit the `.ts` file and redeploy | Admin Panel → Cakes → + New Cake |
| **Shows images** | ❌ | ✅ |
| **Can be ordered** | ❌ price menu only | ✅ cart + checkout |
| **Purpose** | Quick price reference for walk-in / WhatsApp customers | Full online ordering experience |

### Updating the Home Catalog Price List

Edit this file:

```
bakerycakeapp/app/data/catalog.ts
```

Each category entry looks like:

```ts
{
  id: 'fruit-delight',
  icon: '🍓',
  title: 'Fruit Delight',
  subtitle: 'Half KG — Starting ₹400',
  items: [
    { name: 'Black Forest Cake', price: 400 },
    { name: 'Strawberry Cake',   price: 400 },
    // add more rows here
  ],
},
```

After saving and deploying the frontend, the home page price list updates automatically.

### Adding an Orderable Cake

Use the **Admin Panel → Cakes → + New Cake**. It will appear on `/cakes` once set to **Active**.

---

## Running Locally

### Backend (API — port 3000)

```bash
cd BakeryCakeApi

# Copy env template and fill in values
cp .env.example .env

# Install dependencies
bun install

# Push DB schema / run migrations
bun run db:migrate

# Start dev server
bun run dev
```

### Frontend (Nuxt — port 3001)

```bash
cd bakerycakeapp

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret for session signing |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `RESEND_API_KEY` | Resend.com API key (for OTP emails) |
| `EMAIL_FROM` | From address for OTP emails e.g. `hello@yourdomain.com` |
| `RAZORPAY_KEY_ID` | Razorpay key ID (optional — for online payments) |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (optional) |

---

*Built with ❤️ for Shivragi Homemade Bakery — 100% Eggless · Pure Veg · Homemade Fresh*
