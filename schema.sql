-- Fintal Database Schema
-- Beijing Xiaomi Coffee Equipment Co., Ltd. (www.xiaomicafe.net)
-- Supports brands tracking, valuation verification, feedback, reporting and payments.

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    membership_status TEXT DEFAULT 'free', -- 'free' or 'paid'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Brands Table
CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    chinese_name TEXT,
    category TEXT NOT NULL, -- 'Automotive', 'Coffee Machines', 'UAV', 'Electronics'
    logo_url TEXT,
    website TEXT,
    description TEXT,
    verification_status TEXT DEFAULT 'unverified', -- 'unverified', 'pending', 'verified'
    verification_license TEXT, -- text or path representing business license credentials
    verification_contact TEXT, -- contact details submitted during claim
    
    -- 10 Valuation Dimensions (Metrics)
    x1_retail_footprint INTEGER DEFAULT 0,    -- Overseas retail stores / channels count
    x2_social_engagement REAL DEFAULT 0.0,    -- Instagram, YouTube, Reddit engagement rate (%)
    x3_ecommerce_volume INTEGER DEFAULT 0,     -- Cross-border volume (Amazon, Lazada, Shopee)
    x4_intellectual_property INTEGER DEFAULT 0,-- PCT international patents & trademarks count
    x5_search_intent REAL DEFAULT 0.0,         -- Google Trends index
    x6_media_exposure REAL DEFAULT 0.0,        -- Media exposure (Sprudge, PDG, etc.)
    x7_supply_chain_cert INTEGER DEFAULT 0,    -- CE, FDA, RoHS, UL count
    x8_consumer_sentiment REAL DEFAULT 0.0,    -- Trustpilot score
    x9_b2b_trade_volume REAL DEFAULT 0.0,      -- Customs export data & B2B contract volume (M USD)
    x10_premium_index REAL DEFAULT 0.0,        -- Price premium index vs local unbranded equivalent (%)
    
    -- Calculated outputs
    calculated_valuation_usd REAL DEFAULT 0.0,
    cluster_type TEXT NOT NULL, -- 'valued', 'funded', 'organic_taobao'
    
    -- Specificalities for mock data clusters
    taobao_sales_volume INTEGER DEFAULT 0, -- For Cluster 3 (Organic Taobao)
    funding_records TEXT -- For Cluster 2 (Publicly Funded Brands) e.g., JSON list of historical funding
);

-- Singapore Locations Table
CREATE TABLE IF NOT EXISTS singapore_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, -- e.g., 'Orchard Road Mall', 'Downtown CBD', 'Jewel Changi'
    latitude REAL,
    longitude REAL
);

-- Products/Equipment Table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'Automotive', 'Coffee Machines', 'UAV', 'Electronics'
    specs TEXT, -- JSON string or description of specs
    price_sgd REAL,
    singapore_location_ids TEXT, -- Comma-separated list of location IDs
    FOREIGN KEY(brand_id) REFERENCES brands(id)
);

-- Valuation Feedback Log Table
CREATE TABLE IF NOT EXISTS valuation_feedback_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER,
    user_id INTEGER,
    status TEXT NOT NULL, -- 'accepted' or 'rejected'
    reason_dispute TEXT,
    submitted_data TEXT, -- JSON string containing supporting documents / stats
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(brand_id) REFERENCES brands(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Reports Table
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER,
    share_hash TEXT UNIQUE NOT NULL,
    data TEXT, -- JSON string containing report analysis
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(brand_id) REFERENCES brands(id)
);

-- Orders/Transactions Table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    report_id INTEGER,
    amount REAL DEFAULT 7.00, -- 7.00 CNY
    payment_status TEXT DEFAULT 'Pending', -- 'Pending', 'Success', 'Failed'
    gateway TEXT NOT NULL, -- 'WeChat_Pay' or 'Alipay'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(report_id) REFERENCES reports(id)
);
