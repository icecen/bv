const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'fintal.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Establish database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to the Fintal SQLite database.');
  }
});

// Helper function to calculate valuation based on the 10-dimensional model
function calculateValuation(m) {
  const weights = {
    x1: 0.15, // Retail Stores
    x2: 0.08, // Social Media
    x3: 0.15, // E-Commerce Volume
    x4: 0.10, // IP / Patents
    x5: 0.07, // Search Index
    x6: 0.08, // Media Exposure
    x7: 0.07, // Supply Certs
    x8: 0.08, // Sentiment
    x9: 0.15, // B2B Trade
    x10: 0.07 // Premium Index
  };

  // Normalization logic based on realistic metrics
  const nX1 = Math.min((m.x1 || 0) / 200, 1) * 100;
  const nX2 = Math.min((m.x2 || 0) / 15, 1) * 100;
  const nX3 = Math.min((m.x3 || 0) / 30000, 1) * 100;
  const nX4 = Math.min((m.x4 || 0) / 60, 1) * 100;
  const nX5 = Math.min((m.x5 || 0) / 100, 1) * 100;
  const nX6 = Math.min((m.x6 || 0) / 60, 1) * 100;
  const nX7 = Math.min((m.x7 || 0) / 15, 1) * 100;
  const nX8 = Math.min((m.x8 || 0) / 5, 1) * 100;
  const nX9 = Math.min((m.x9 || 0) / 50, 1) * 100; // In millions USD
  const nX10 = Math.min((m.x10 || 0) / 100, 1) * 100;

  const score = 
    weights.x1 * nX1 +
    weights.x2 * nX2 +
    weights.x3 * nX3 +
    weights.x4 * nX4 +
    weights.x5 * nX5 +
    weights.x6 * nX6 +
    weights.x7 * nX7 +
    weights.x8 * nX8 +
    weights.x9 * nX9 +
    weights.x10 * nX10;

  // Scale score to USD valuation: min $100,000, max $150,000,000
  const valuation = 100000 + (score / 100) * 149900000;
  return Math.round(valuation);
}

// Function to run database initialization
function initDatabase(callback) {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  
  // Split schema file by semicolons to execute individual queries
  // (Filter out empty queries and SQL comments)
  const queries = schema
    .split(';')
    .map(q => q.trim())
    .filter(q => q.length > 0 && !q.startsWith('--'));

  db.serialize(() => {
    // Run schema setup
    for (const query of queries) {
      db.run(query, (err) => {
        if (err) {
          console.error('Error executing query:', query);
          console.error(err.message);
        }
      });
    }

    // Check if table users contains data, if not, perform seed
    db.get("SELECT COUNT(*) as count FROM brands", [], (err, row) => {
      if (err) {
        console.error("Error checking brands data:", err.message);
        return;
      }
      if (row.count === 0) {
        console.log("Database is empty. Seeding mock data...");
        seedData();
      } else {
        console.log("Database already initialized with data.");
      }
      if (callback) callback();
    });
  });
}

function seedData() {
  // 1. Seed Locations
  const locations = [
    { name: 'Orchard Road Malls', lat: 1.3025, lng: 103.8358 },
    { name: 'Downtown CBD (Marina Bay)', lat: 1.2823, lng: 103.8584 },
    { name: 'Jewel Changi Airport', lat: 1.3599, lng: 103.9894 },
    { name: 'Holland Village', lat: 1.3117, lng: 103.7959 }
  ];

  const stmtLoc = db.prepare("INSERT INTO singapore_locations (name, latitude, longitude) VALUES (?, ?, ?)");
  locations.forEach(loc => {
    stmtLoc.run(loc.name, loc.lat, loc.lng);
  });
  stmtLoc.finalize();

  // 2. Seed Users (Including 1 admin and some members)
  const users = [
    { username: 'admin', email: 'admin@xiaomicafe.net', password_hash: 'admin123', role: 'admin', membership_status: 'paid', phone: '+86 18888888888' },
    { username: 'user1', email: 'owner@gemilai.com', password_hash: 'user123', role: 'user', membership_status: 'free', phone: '+86 13912345678' },
    { username: 'user2', email: 'owner@mhw3bomber.com', password_hash: 'user123', role: 'user', membership_status: 'free', phone: '+86 13700001111' },
    { username: 'visitor', email: 'visitor@gmail.com', password_hash: 'visitor123', role: 'user', membership_status: 'free', phone: '+65 91234567' }
  ];

  const stmtUser = db.prepare("INSERT INTO users (username, email, password_hash, role, membership_status, phone) VALUES (?, ?, ?, ?, ?, ?)");
  users.forEach(user => {
    stmtUser.run(user.username, user.email, user.password_hash, user.role, user.membership_status, user.phone);
  });
  stmtUser.finalize();

  // 3. Seed Brands
  const brandsList = [
    // Cluster 1: Explicitly Valued Coffee Equipment Brands
    {
      name: 'Gemilai',
      chinese_name: '格米莱',
      category: 'Coffee Machines',
      logo_url: 'gemilai_logo.png',
      website: 'www.gemilai.com',
      description: 'Guangdong Gemilai Technology Joint-Stock Co., Ltd. Professional commercial and semi-professional espresso machines.',
      verification_status: 'verified',
      verification_license: 'Gemilai_Business_License.jpg',
      verification_contact: 'owner@gemilai.com',
      x1: 45, x2: 3.5, x3: 4200, x4: 18, x5: 28, x6: 12, x7: 6, x8: 4.1, x9: 8.5, x10: 35,
      cluster_type: 'valued',
      taobao_sales_volume: 0,
      funding_records: null
    },
    {
      name: 'WPM Welhome Pro',
      chinese_name: '惠家',
      category: 'Coffee Machines',
      logo_url: 'wpm_logo.png',
      website: 'www.wpmcoffee.com',
      description: 'GMP Industrial Co., Ltd. Premium coffee espresso machines, high-quality milk steamers, and conical burr grinders.',
      verification_status: 'pending',
      verification_license: 'WPM_License_2026.pdf',
      verification_contact: 'export@wpmcoffee.com',
      x1: 90, x2: 8.2, x3: 12000, x4: 45, x5: 65, x6: 45, x7: 11, x8: 4.5, x9: 22.0, x10: 55,
      cluster_type: 'valued',
      taobao_sales_volume: 0,
      funding_records: null
    },
    {
      name: 'HiBREW',
      chinese_name: '海焙',
      category: 'Coffee Machines',
      logo_url: 'hibrew_logo.png',
      website: 'www.hibrew.cn',
      description: 'Foshan Shunde HiBREW Electrical Appliances Co., Ltd. Multi-capsule extraction specialists and travel coffee machines.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 120, x2: 6.8, x3: 25000, x4: 32, x5: 50, x6: 28, x7: 10, x8: 4.3, x9: 18.5, x10: 15,
      cluster_type: 'valued',
      taobao_sales_volume: 0,
      funding_records: null
    },
    {
      name: 'MHW-3BOMBER',
      chinese_name: '轰炸机',
      category: 'Coffee Machines',
      logo_url: 'mhw_logo.png',
      website: 'www.mhw3bomber.com',
      description: 'Zhongshan Bomber Coffee Equipment Co., Ltd. World-class specialty coffee extraction accessories, milk pitchers, and tampers.',
      verification_status: 'verified',
      verification_license: 'MHW_Bomber_CN_License.png',
      verification_contact: 'contact@mhw3bomber.com',
      x1: 180, x2: 11.2, x3: 28000, x4: 52, x5: 78, x6: 55, x7: 14, x8: 4.6, x9: 30.0, x10: 80,
      cluster_type: 'valued',
      taobao_sales_volume: 0,
      funding_records: null
    },
    
    // Cluster 2: Publicly Funded Brands
    {
      name: 'BYD',
      chinese_name: '比亚迪',
      category: 'Automotive',
      logo_url: 'byd_logo.png',
      website: 'www.bydglobal.com',
      description: 'BYD Auto Co., Ltd. Pioneer in new energy electric vehicles and battery technologies.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 1200, x2: 25.0, x3: 95000, x4: 350, x5: 95, x6: 90, x7: 28, x8: 4.4, x9: 350.0, x10: 60,
      cluster_type: 'funded',
      taobao_sales_volume: 0,
      funding_records: JSON.stringify([
        { round: 'IPO (HKEX)', amount: '1.2B HKD', year: 2002 },
        { round: 'Private Placement (Warren Buffett)', amount: '232M USD', year: 2008 },
        { round: 'H-Share Placement', amount: '3.8B USD', year: 2021 }
      ])
    },
    {
      name: 'NIO',
      chinese_name: '蔚来',
      category: 'Automotive',
      logo_url: 'nio_logo.png',
      website: 'www.nio.com',
      description: 'NIO Inc. Premium smart electric vehicle manufacturer with unique battery swap technologies.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 80, x2: 18.5, x3: 5000, x4: 120, x5: 82, x6: 75, x7: 18, x8: 4.6, x9: 45.0, x10: 90,
      cluster_type: 'funded',
      taobao_sales_volume: 0,
      funding_records: JSON.stringify([
        { round: 'Series D', amount: '1B USD', year: 2017 },
        { round: 'IPO (NYSE)', amount: '1B USD', year: 2018 },
        { round: 'Strategic Funding (Hefei Government)', amount: '1.4B USD', year: 2020 }
      ])
    },
    {
      name: 'DJI',
      chinese_name: '大疆创新',
      category: 'UAV/Aircraft',
      logo_url: 'dji_logo.png',
      website: 'www.dji.com',
      description: 'SZ DJI Technology Co., Ltd. Global leader in civilian drones, aerial imaging tech, and camera stabilization.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 1500, x2: 35.0, x3: 150000, x4: 800, x5: 99, x6: 98, x7: 35, x8: 4.7, x9: 900.0, x10: 120,
      cluster_type: 'funded',
      taobao_sales_volume: 0,
      funding_records: JSON.stringify([
        { round: 'Series A (Sequoia Capital)', amount: '30M USD', year: 2013 },
        { round: 'Series B (Accel)', amount: '75M USD', year: 2015 },
        { round: 'Strategic Round', amount: '1B USD', year: 2018 }
      ])
    },
    {
      name: 'Luckin Coffee',
      chinese_name: '瑞幸咖啡',
      category: 'Coffee Machines', // Fits coffee category
      logo_url: 'luckin_logo.png',
      website: 'www.luckincoffee.com',
      description: 'Luckin Coffee Inc. Tech-driven coffee retail chain, scaling hyper-growth operations.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 8200, x2: 22.0, x3: 1500, x4: 25, x5: 70, x6: 60, x7: 8, x8: 4.2, x9: 10.0, x10: 10,
      cluster_type: 'funded',
      taobao_sales_volume: 0,
      funding_records: JSON.stringify([
        { round: 'Series A', amount: '200M USD', year: 2018 },
        { round: 'Series B', amount: '200M USD', year: 2018 },
        { round: 'IPO (NASDAQ)', amount: '561M USD', year: 2019 }
      ])
    },
    
    // Cluster 3: Organic Taobao Brands (Active sales, 0 funding, low/zero initial overseas metrics)
    {
      name: 'Hero',
      chinese_name: '英雄咖啡',
      category: 'Coffee Machines',
      logo_url: 'hero_logo.png',
      website: 'www.herocoffee.com.cn',
      description: 'Beijing Hero Coffee Appliance Co., Ltd. Quality hand-drip sets, scales, and smart manual grinders.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 2, x2: 0.5, x3: 200, x4: 5, x5: 5, x6: 2, x7: 1, x8: 3.8, x9: 0.5, x10: 5,
      cluster_type: 'organic_taobao',
      taobao_sales_volume: 18000,
      funding_records: null
    },
    {
      name: 'Bincoo',
      chinese_name: '缤蔻',
      category: 'Coffee Machines',
      logo_url: 'bincoo_logo.png',
      website: 'www.bincoo.cn',
      description: 'High-aesthetic personal manual coffee pots, creative moka pots, and espresso cups.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 0, x2: 1.2, x3: 500, x4: 3, x5: 8, x6: 4, x7: 2, x8: 4.0, x9: 0.2, x10: 12,
      cluster_type: 'organic_taobao',
      taobao_sales_volume: 25000,
      funding_records: null
    },
    {
      name: 'Watchget',
      chinese_name: '咖之翼',
      category: 'Coffee Machines',
      logo_url: 'watchget_logo.png',
      website: 'www.watchget.com',
      description: 'Guangzhou Watchget Co., Ltd. Precision filter baskets, espresso distributors, and tamper tools.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 1, x2: 0.8, x3: 800, x4: 2, x5: 4, x6: 3, x7: 1, x8: 4.1, x9: 0.4, x10: 8,
      cluster_type: 'organic_taobao',
      taobao_sales_volume: 12000,
      funding_records: null
    },
    {
      name: 'Starseeker',
      chinese_name: '星寻',
      category: 'Coffee Machines',
      logo_url: 'starseeker_logo.png',
      website: 'www.starseeker.cn',
      description: 'Home-use electric flat-burr coffee grinders with high price-performance ratio.',
      verification_status: 'unverified',
      verification_license: null,
      verification_contact: null,
      x1: 0, x2: 0.4, x3: 100, x4: 4, x5: 3, x6: 1, x7: 1, x8: 3.9, x9: 0.1, x10: 15,
      cluster_type: 'organic_taobao',
      taobao_sales_volume: 9500,
      funding_records: null
    }
  ];

  const stmtBrand = db.prepare(`
    INSERT INTO brands (
      name, chinese_name, category, logo_url, website, description,
      verification_status, verification_license, verification_contact,
      x1_retail_footprint, x2_social_engagement, x3_ecommerce_volume,
      x4_intellectual_property, x5_search_intent, x6_media_exposure,
      x7_supply_chain_cert, x8_consumer_sentiment, x9_b2b_trade_volume,
      x10_premium_index, calculated_valuation_usd, cluster_type,
      taobao_sales_volume, funding_records
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  brandsList.forEach(b => {
    const valUSD = calculateValuation({
      x1: b.x1, x2: b.x2, x3: b.x3, x4: b.x4, x5: b.x5,
      x6: b.x6, x7: b.x7, x8: b.x8, x9: b.x9, x10: b.x10
    });
    stmtBrand.run(
      b.name, b.chinese_name, b.category, b.logo_url, b.website, b.description,
      b.verification_status, b.verification_license, b.verification_contact,
      b.x1, b.x2, b.x3, b.x4, b.x5, b.x6, b.x7, b.x8, b.x9, b.x10,
      valUSD, b.cluster_type, b.taobao_sales_volume, b.funding_records
    );
  });
  stmtBrand.finalize();

  // 4. Seed Products
  // Let's retrieve brand IDs dynamically to seed products
  db.all("SELECT id, name FROM brands", [], (err, rows) => {
    if (err) {
      console.error("Error retrieving seeded brands for product setup:", err.message);
      return;
    }
    
    const brandMap = {};
    rows.forEach(r => brandMap[r.name] = r.id);

    const products = [
      { brand_name: 'Gemilai', name: 'CRM3605 Home Espresso Machine', category: 'Coffee Machines', specs: '15-bar Italian ULKA pump, thermoblock heating, 1.7L capacity', price: 189, loc_ids: '1,4' },
      { brand_name: 'Gemilai', name: 'CRM3007G Rotary Pump Machine', category: 'Coffee Machines', specs: 'Commercial rotary pump, PID temp control, 58mm handle', price: 899, loc_ids: '1' },
      
      { brand_name: 'WPM Welhome Pro', name: 'KD-310 Premium Coffee Machine', category: 'Coffee Machines', specs: 'Triple thermoblock heating, PID pressure settings, commercial steam wand', price: 1650, loc_ids: '2,3' },
      { brand_name: 'WPM Welhome Pro', name: 'ZD-17 Burr Grinder', category: 'Coffee Machines', specs: 'Conical steel burrs, 30 grind levels, anti-static design', price: 340, loc_ids: '2,4' },
      
      { brand_name: 'HiBREW', name: 'H10A Portable Espresso Machine', category: 'Coffee Machines', specs: 'Cold/Hot extraction, 19-bar pressure, fits multiple capsule types', price: 159, loc_ids: '1' },
      
      { brand_name: 'MHW-3BOMBER', name: 'Flash Constant Pressure Tamper', category: 'Coffee Machines', specs: '30lbs spring-loaded feedback, 58.35mm base diameter, stainless steel', price: 45, loc_ids: '1,2,3,4' },
      { brand_name: 'MHW-3BOMBER', name: 'Formula Milk Pitcher 450ml', category: 'Coffee Machines', specs: 'Pointy eagle spout for latte art, sandblasted interior, Teflon coat', price: 28, loc_ids: '1,2,3' },

      { brand_name: 'BYD', name: 'BYD ATTO 3 (New Energy SUV)', category: 'Automotive', specs: 'Blade Battery technology, 150 kW motor, 480km range (WLTP)', price: 175000, loc_ids: '2' },
      { brand_name: 'NIO', name: 'NIO ET5 Smart Electric Sedan', category: 'Automotive', specs: '100 kWh battery swap, 0-100 km/h in 4.3s, NIO Pilot autonomous assist', price: 195000, loc_ids: '3' },
      
      { brand_name: 'DJI', name: 'DJI Mini 4 Pro Fly More Combo', category: 'UAV/Aircraft', specs: 'Under 249g weight, omnidirectional obstacle sensing, 4K/60fps HDR video', price: 1399, loc_ids: '1,3' }
    ];

    const stmtProd = db.prepare("INSERT INTO products (brand_id, name, category, specs, price_sgd, singapore_location_ids) VALUES (?, ?, ?, ?, ?, ?)");
    products.forEach(p => {
      const bId = brandMap[p.brand_name];
      if (bId) {
        stmtProd.run(bId, p.name, p.category, p.specs, p.price, p.loc_ids);
      }
    });
    stmtProd.finalize();

    // 5. Seed some initial user feedback rejections and transactions for dashboard demo
    db.run("INSERT INTO valuation_feedback_log (brand_id, user_id, status, reason_dispute, submitted_data) VALUES (3, 2, 'rejected', 'We have recently expanded our channel sales in Europe, adding 15 new stores. The retail footprint score of 120 is lower than our actual 145 channels.', '{\"actual_retail_stores\": 145}')");
    
    // Seed reports and initial transaction ledger
    const reportHash = '3a7c89f53e20e8b2b9183427f71bcf80b2961e5b128532454a7c89f53e20e8b2';
    db.run(`
      INSERT INTO reports (brand_id, share_hash, data) 
      VALUES (4, '${reportHash}', '{"brand_name":"MHW-3BOMBER","score":67.8,"calculated_valuation":35000000,"generated_at":"2026-07-01"}')
    `, (err) => {
      if (!err) {
        db.run(`
          INSERT INTO orders (order_id, user_id, report_id, amount, payment_status, gateway)
          VALUES ('ORD-20260701-001', 4, 1, 7.00, 'Success', 'WeChat_Pay')
        `);
        db.run(`
          INSERT INTO orders (order_id, user_id, report_id, amount, payment_status, gateway)
          VALUES ('ORD-20260701-002', 4, 1, 7.00, 'Success', 'Alipay')
        `);
      }
    });

    console.log("Mock data seeding completed successfully.");
  });
}

module.exports = {
  db,
  initDatabase,
  calculateValuation
};
