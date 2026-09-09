-- ==============================================================================
-- GrabIt Complete Schema + Comprehensive Demo Data Dump
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/vhcmjwuhdcdxqmyjvqpz/sql
-- ==============================================================================

-- 1. EXTENSIONS
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- 2. CUSTOM TYPES
do $$ begin
  create type public.user_role as enum ('customer', 'seller', 'delivery_agent', 'admin');
exception
  when duplicate_object then null;
end $$;

-- 3. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  full_name text not null,
  email text,
  avatar_url text,
  selfie_image text,
  vehicle text,
  plate text,
  license_plate text,
  driving_license text,
  insurance_no text,
  bg_check_ref text,
  biometrics_done boolean default false,
  clearances jsonb,
  clearance_timestamps jsonb,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

-- 4. STORES TABLE
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  address text,
  location geography(point, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 5. CATEGORIES TABLE
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text,
  image_url text,
  created_at timestamptz default now()
);

-- 6. PRODUCTS TABLE
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  price numeric(10,2) not null check(price > 0),
  stock integer not null default 0 check(stock >= 0),
  image_url text,
  unit text default '1 unit',
  rating numeric(2,1) default 4.8,
  created_at timestamptz default now()
);

-- 7. CART ITEMS TABLE
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  quantity integer not null check(quantity > 0),
  unique(user_id, product_id)
);

-- 8. ORDERS TABLE
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,
  delivery_agent_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  delivery_address text not null,
  delivery_location geography(point, 4326),
  status text not null default 'placed',
  total numeric(10,2) default 0,
  created_at timestamptz default now()
);

-- 9. PAYMENTS TABLE
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  amount numeric(10,2),
  status text,
  created_at timestamptz default now()
);

-- 10. POSTGIS PROXIMITY FUNCTION
create or replace function public.nearby_stores(lat double precision, lng double precision, radius_m integer default 5000)
returns setof public.stores language sql stable as $$
  select * from public.stores
  where is_active and st_dwithin(location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m);
$$;

-- 11. ANALYTICS VIEW
create or replace view public.analytics_daily as
  select date(created_at) as day, count(*) as orders, coalesce(sum(total),0) as earnings
  from public.orders
  where status = 'delivered'
  group by 1;

-- 12. RLS PERMISSION CONFIGURATION
alter table public.profiles disable row level security;
alter table public.stores disable row level security;
alter table public.products disable row level security;
alter table public.categories disable row level security;
alter table public.cart_items disable row level security;
alter table public.orders disable row level security;
alter table public.payments disable row level security;

-- ==============================================================================
-- 13. COMPREHENSIVE DEMO DATA DUMP
-- ==============================================================================

-- A. DEMO USERS
insert into public.profiles (phone, full_name, email, role) values
  ('+919999900001', 'Admin Supervisor', 'admin@grabit.local', 'admin'),
  ('+919999900002', 'Fresh Mart Supermarket', 'seller@grabit.local', 'seller'),
  ('+919999900003', 'Speedy Express Delivery', 'rider@grabit.local', 'delivery_agent'),
  ('+919999900004', 'Rahul Sharma', 'customer@grabit.local', 'customer')
on conflict (phone) do update set full_name = excluded.full_name, role = excluded.role;

-- B. DEMO CATEGORIES
insert into public.categories (name, slug, image_url) values
  ('Snacks & Munchies', 'snacks-munchies', '/category-snacks-feast-hero.png'),
  ('Dairy & Bakery', 'dairy-bakery', '/dairy-hero-transparent.png'),
  ('Cold Drinks & Juices', 'beverages', '/beverages-hero-transparent.png'),
  ('Atta, Rice & Dal', 'staples', '/staples-hero-transparent.png'),
  ('Chocolates & Sweets', 'chocolates', '/chocolates-hero-transparent.png'),
  ('Fruits & Vegetables', 'produce', '/fresh-groceries-basket-only.png'),
  ('Personal Care', 'personal-care', '/personal-care-hero-cutout.png'),
  ('Household & Cleaning', 'household', '/household-hero-transparent.png'),
  ('Electronics & Gear', 'electronics', '/electronics-hero-cutout.png'),
  ('Fashion & Accessories', 'fashion', '/fashion-hero-cutout.png')
on conflict (name) do update set slug = excluded.slug, image_url = excluded.image_url;

-- C. DEMO STORE & PRODUCTS
do $$
declare
  v_seller_id uuid;
  v_store_id uuid;
  v_cat_snacks uuid;
  v_cat_dairy uuid;
  v_cat_bev uuid;
  v_cat_staples uuid;
  v_cat_choc uuid;
  v_cat_produce uuid;
  v_cat_pc uuid;
  v_cat_house uuid;
begin
  select id into v_seller_id from public.profiles where phone = '+919999900002';

  if v_seller_id is not null then
    insert into public.stores (owner_id, name, address, location, is_active)
    values (
      v_seller_id,
      'GrabIt SuperMart (Indiranagar)',
      'Shop 14, 100ft Road, Indiranagar, Bengaluru 560038',
      st_setsrid(st_makepoint(77.5946, 12.9716), 4326)::geography,
      true
    )
    on conflict do nothing;

    select id into v_store_id from public.stores where owner_id = v_seller_id limit 1;

    select id into v_cat_snacks from public.categories where slug = 'snacks-munchies';
    select id into v_cat_dairy from public.categories where slug = 'dairy-bakery';
    select id into v_cat_bev from public.categories where slug = 'beverages';
    select id into v_cat_staples from public.categories where slug = 'staples';
    select id into v_cat_choc from public.categories where slug = 'chocolates';
    select id into v_cat_produce from public.categories where slug = 'produce';
    select id into v_cat_pc from public.categories where slug = 'personal-care';
    select id into v_cat_house from public.categories where slug = 'household';

    if v_store_id is not null then
      -- Delete any outdated test rows before dumping rich demo catalog
      delete from public.products where store_id = v_store_id;

      insert into public.products (store_id, category_id, name, price, stock, image_url, unit, rating) values
        -- Snacks & Munchies
        (v_store_id, v_cat_snacks, 'Lay''s India''s Magic Masala Potato Chips', 20.00, 100, '/lays-magic-masala.png', '50g', 4.9),
        (v_store_id, v_cat_snacks, 'Lay''s American Style Cream & Onion Chips', 20.00, 85, '/lays-cream-onion.png', '50g', 4.8),
        (v_store_id, v_cat_snacks, 'Doritos Cheese Supreme Nachos', 50.00, 60, '/doritos-nacho.png', '82.5g', 4.9),
        (v_store_id, v_cat_snacks, 'Bingo! Mad Angles Achaari Masti', 20.00, 70, '/bingo-mad-angles.png', '66g', 4.7),

        -- Dairy & Bakery
        (v_store_id, v_cat_dairy, 'Amul Salted Butter (Pasteurized)', 56.00, 60, '/amul-butter-real.jpg', '100g', 4.9),
        (v_store_id, v_cat_dairy, 'Farm Fresh Pasteurized Milk', 34.00, 80, '/amul-butter-real.jpg', '500ml', 4.8),
        (v_store_id, v_cat_dairy, 'Cadbury Oreo Original Vanilla Sandwich Biscuits', 40.00, 90, '/oreo-biscuits-real.jpg', '120g', 4.8),

        -- Staples
        (v_store_id, v_cat_staples, 'Aashirvaad Shudh Chakki Whole Wheat Atta', 230.00, 45, '/aashirvaad-atta-real.jpg', '5kg', 4.9),
        (v_store_id, v_cat_staples, 'Fortune Sunlite Refined Sunflower Oil', 145.00, 50, '/fortune-oil-real.jpg', '1L', 4.8),
        (v_store_id, v_cat_staples, 'Maggi 2-Minute Masala Instant Noodles (Pack of 4)', 56.00, 120, '/maggi-noodles-real.jpg', '280g', 4.9),

        -- Cold Drinks & Juices
        (v_store_id, v_cat_bev, 'Coca-Cola Original Taste Soft Drink', 40.00, 95, '/coca-cola-real.jpg', '750ml', 4.9),
        (v_store_id, v_cat_bev, 'Nescafé Classic Instant Coffee', 185.00, 40, '/nescafe-coffee-real.jpg', '50g', 4.8),

        -- Chocolates & Sweets
        (v_store_id, v_cat_choc, 'Cadbury Dairy Milk Silk Chocolate Bar', 85.00, 80, '/cadbury-silk-real.jpg', '60g', 4.9),

        -- Fresh Produce
        (v_store_id, v_cat_produce, 'Fresh Kashmiri Royal Gala Apples (4 pcs)', 149.00, 40, '/fresh-red-apples-real.jpg', '500g', 4.8),
        (v_store_id, v_cat_produce, 'Fresh Organic Robusta Bananas (1kg)', 59.00, 60, '/apples-real.jpg', '1kg', 4.7),

        -- Household & Personal Care
        (v_store_id, v_cat_pc, 'Dettol Original Germ Protection Liquid Handwash', 99.00, 55, '/dettol-handwash-real.jpg', '200ml', 4.9),
        (v_store_id, v_cat_house, 'Surf Excel Easy Wash Detergent Powder', 150.00, 45, '/surf-excel-real.jpg', '1kg', 4.9);
    end if;
  end if;
end $$;

-- D. DEMO ORDERS
do $$
declare
  v_cust_id uuid;
  v_seller_id uuid;
  v_rider_id uuid;
  v_store_id uuid;
begin
  select id into v_cust_id from public.profiles where phone = '+919999900004';
  select id into v_seller_id from public.profiles where phone = '+919999900002';
  select id into v_rider_id from public.profiles where phone = '+919999900003';
  select id into v_store_id from public.stores where owner_id = v_seller_id limit 1;

  if v_cust_id is not null and v_store_id is not null then
    insert into public.orders (customer_id, seller_id, delivery_agent_id, store_id, delivery_address, status, total, created_at) values
      (v_cust_id, v_seller_id, v_rider_id, v_store_id, 'Flat 402, Green Glen Layout, Bellandur, Bengaluru', 'out_for_delivery', 286.00, now() - interval '10 minutes'),
      (v_cust_id, v_seller_id, v_rider_id, v_store_id, 'Flat 402, Green Glen Layout, Bellandur, Bengaluru', 'delivered', 420.00, now() - interval '1 day'),
      (v_cust_id, v_seller_id, v_rider_id, v_store_id, 'Flat 402, Green Glen Layout, Bellandur, Bengaluru', 'delivered', 185.00, now() - interval '3 days')
    on conflict do nothing;
  end if;
end $$;
