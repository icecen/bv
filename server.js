const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { db, initDatabase, calculateValuation } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static client files
app.use(express.static(path.join(__dirname, 'public')));

// Simple mock user session state
let currentSessionUser = null; 

// RBAC Middleware to protect Admin Routes
const requireAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'] || (currentSessionUser ? currentSessionUser.role : 'user');
  if (userRole === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Access Denied: Admin role required.' });
  }
};

// ==========================================
// USER AUTHENTICATION & SESSION ENDPOINTS
// ==========================================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ? AND password_hash = ?", [username, password], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    currentSessionUser = row;
    res.json({ message: 'Login successful', user: { id: row.id, username: row.username, email: row.email, role: row.role, membership_status: row.membership_status } });
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, phone, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }
  
  db.run(
    "INSERT INTO users (username, email, phone, password_hash, role, membership_status) VALUES (?, ?, ?, ?, 'user', 'free')",
    [username, email, phone, password],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      db.get("SELECT * FROM users WHERE id = ?", [this.lastID], (err, row) => {
        if (row) {
          currentSessionUser = row;
          res.status(201).json({ message: 'User registered', user: { id: row.id, username: row.username, email: row.email, role: row.role, membership_status: row.membership_status } });
        } else {
          res.status(500).json({ error: 'Error creating user session' });
        }
      });
    }
  );
});

app.post('/api/auth/logout', (req, res) => {
  currentSessionUser = null;
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/session', (req, res) => {
  if (currentSessionUser) {
    db.get("SELECT * FROM users WHERE id = ?", [currentSessionUser.id], (err, row) => {
      if (row) {
        currentSessionUser = row;
        res.json({ user: { id: row.id, username: row.username, email: row.email, role: row.role, membership_status: row.membership_status } });
      } else {
        res.json({ user: null });
      }
    });
  } else {
    res.json({ user: null });
  }
});


// ==========================================
// BRAND TRACKING & VISUALIZATION ENDPOINTS
// ==========================================

// Get all brands (with optional search and category filters)
app.get('/api/brands', (req, res) => {
  const { search, category, cluster } = req.query;
  let sql = "SELECT * FROM brands WHERE 1=1";
  const params = [];

  if (search) {
    sql += " AND (name LIKE ? OR chinese_name LIKE ? OR description LIKE ?)";
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  if (category && category !== 'All') {
    sql += " AND category = ?";
    params.push(category);
  }

  if (cluster) {
    sql += " AND cluster_type = ?";
    params.push(cluster);
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get detailed brand info including products and location references
app.get('/api/brands/:id', (req, res) => {
  const brandId = req.params.id;

  db.get("SELECT * FROM brands WHERE id = ?", [brandId], (err, brand) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    // Fetch products associated with the brand
    db.all("SELECT * FROM products WHERE brand_id = ?", [brandId], (err, products) => {
      if (err) return res.status(500).json({ error: err.message });

      // Fetch all locations to match with product distribution
      db.all("SELECT * FROM singapore_locations", [], (err, locations) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          brand,
          products: products.map(p => {
            const locIds = p.singapore_location_ids ? p.singapore_location_ids.split(',').map(Number) : [];
            const mappedLocs = locations.filter(loc => locIds.includes(loc.id));
            return { ...p, locations: mappedLocs };
          })
        });
      });
    });
  });
});

// Claim Brand Ownership
app.post('/api/brands/claim', (req, res) => {
  const { brandId, licenseFile, contactInfo } = req.body;
  if (!brandId || !licenseFile || !contactInfo) {
    return res.status(400).json({ error: 'Brand ID, business license credentials, and contact info are required' });
  }

  db.run(
    "UPDATE brands SET verification_status = 'pending', verification_license = ?, verification_contact = ? WHERE id = ?",
    [licenseFile, contactInfo, brandId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Claim submitted. Brand ownership verification is now pending admin approval.' });
    }
  );
});

// Update/Query Brand Valuation (10-dimensional model recalculation)
app.post('/api/brands/valuation', (req, res) => {
  const { brandId, metrics } = req.body;
  if (!brandId || !metrics) {
    return res.status(400).json({ error: 'Brand ID and valuation metrics are required' });
  }

  // Calculate new valuation
  const valuation = calculateValuation(metrics);

  // If verified owner, optionally update in DB. Otherwise, just return calculations.
  db.run(
    `UPDATE brands SET 
      x1_retail_footprint = ?, x2_social_engagement = ?, x3_ecommerce_volume = ?,
      x4_intellectual_property = ?, x5_search_intent = ?, x6_media_exposure = ?,
      x7_supply_chain_cert = ?, x8_consumer_sentiment = ?, x9_b2b_trade_volume = ?,
      x10_premium_index = ?, calculated_valuation_usd = ? 
    WHERE id = ?`,
    [
      metrics.x1, metrics.x2, metrics.x3, metrics.x4, metrics.x5,
      metrics.x6, metrics.x7, metrics.x8, metrics.x9, metrics.x10,
      valuation, brandId
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        message: 'Valuation updated successfully', 
        valuationUSD: valuation,
        metrics
      });
    }
  );
});

// Submit valuation feedback (Accept / Reject dispute loop)
app.post('/api/brands/feedback', (req, res) => {
  const { brandId, status, reason, submittedData } = req.body;
  const userId = currentSessionUser ? currentSessionUser.id : null;

  if (!brandId || !status) {
    return res.status(400).json({ error: 'Brand ID and dispute status are required' });
  }

  db.run(
    "INSERT INTO valuation_feedback_log (brand_id, user_id, status, reason_dispute, submitted_data) VALUES (?, ?, ?, ?, ?)",
    [brandId, userId, status, reason || '', submittedData ? JSON.stringify(submittedData) : ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Feedback log recorded. Thank you for your input.' });
    }
  );
});


// ==========================================
// REPORT & PAYWALL ENDPOINTS
// ==========================================

// Generate Shareable Link (Report hash creation)
app.post('/api/reports/generate', (req, res) => {
  const { brandId, reportData } = req.body;
  if (!brandId || !reportData) {
    return res.status(400).json({ error: 'Brand ID and report details are required' });
  }

  // Create unique cryptographic hash
  const timestamp = Date.now().toString();
  const rawString = `${brandId}-${timestamp}-${Math.random()}`;
  const shareHash = crypto.createHash('sha256').update(rawString).digest('hex');

  db.run(
    "INSERT INTO reports (brand_id, share_hash, data) VALUES (?, ?, ?)",
    [brandId, shareHash, JSON.stringify(reportData)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ 
        message: 'Shareable report link generated successfully.',
        shareHash: shareHash,
        shareUrl: `/report/share/${shareHash}`
      });
    }
  );
});

// Gated Shared Report Endpoint
app.get('/api/reports/share/:hash', (req, res) => {
  const shareHash = req.params.hash;

  db.get(`
    SELECT r.*, b.name as brand_name, b.chinese_name as brand_chinese_name 
    FROM reports r 
    JOIN brands b ON r.brand_id = b.id 
    WHERE r.share_hash = ?
  `, [shareHash], (err, report) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Check if the current user is a paid member
    const isPaid = currentSessionUser && currentSessionUser.membership_status === 'paid';

    if (isPaid) {
      // Return full decrypted report data
      res.json({ 
        gated: false, 
        report: {
          id: report.id,
          brand_id: report.brand_id,
          brand_name: report.brand_name,
          brand_chinese_name: report.brand_chinese_name,
          share_hash: report.share_hash,
          data: JSON.parse(report.data),
          generated_at: report.generated_at
        }
      });
    } else {
      // Intercept by paywall: Return limited metadata & flag as gated
      res.json({
        gated: true,
        brand_name: report.brand_name,
        brand_chinese_name: report.brand_chinese_name,
        message: 'This premium report is locked. Complete registration and a payment of 7 RMB to access.'
      });
    }
  });
});

// Unlock Gated Report (Simulated Payment Gate & Membership Registration)
app.post('/api/reports/unlock', (req, res) => {
  const { shareHash, username, email, phone, password, gateway } = req.body;
  
  if (!shareHash || !username || !email || !phone || !password || !gateway) {
    return res.status(400).json({ error: 'Registration details and payment gateway are required to unlock the report.' });
  }

  // Transaction block:
  // 1. Create or login the user
  // 2. Set their membership status to 'paid' (Simulating success payment of 7 RMB)
  // 3. Create a success Order entry in the database
  // 4. Retrieve and return the report content

  db.serialize(() => {
    // 1. Upsert User (or find by email/username) and mark as paid
    db.run(
      `INSERT INTO users (username, email, phone, password_hash, role, membership_status) 
       VALUES (?, ?, ?, ?, 'user', 'paid')
       ON CONFLICT(username) DO UPDATE SET membership_status = 'paid', phone = ?
       ON CONFLICT(email) DO UPDATE SET membership_status = 'paid', phone = ?`,
      [username, email, phone, password, phone, phone],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'User registration failed during checkout: ' + err.message });
        }

        // Get the user ID
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
          if (err || !user) {
            return res.status(500).json({ error: 'Failed to retrieve registered user profile' });
          }

          // Set current user session to this newly registered / logged-in user
          currentSessionUser = user;

          // 2. Retrieve report info to create transaction order
          db.get("SELECT * FROM reports WHERE share_hash = ?", [shareHash], (err, report) => {
            if (err || !report) {
              return res.status(500).json({ error: 'Could not find report during payment processing' });
            }

            // 3. Insert Order Transaction
            const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            db.run(
              "INSERT INTO orders (order_id, user_id, report_id, amount, payment_status, gateway) VALUES (?, ?, ?, 7.00, 'Success', ?)",
              [orderId, user.id, report.id, gateway],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Failed to record transaction log: ' + err.message });
                }

                // 4. Return unlocked report content
                db.get(`
                  SELECT r.*, b.name as brand_name, b.chinese_name as brand_chinese_name 
                  FROM reports r 
                  JOIN brands b ON r.brand_id = b.id 
                  WHERE r.share_hash = ?
                `, [shareHash], (err, updatedReport) => {
                  if (err || !updatedReport) {
                    return res.status(500).json({ error: 'Failed to retrieve unlocked report details' });
                  }
                  
                  res.json({
                    success: true,
                    message: 'Payment of 7 RMB successful. Membership activated. Report unlocked.',
                    user: {
                      id: user.id,
                      username: user.username,
                      email: user.email,
                      membership_status: user.membership_status
                    },
                    report: {
                      id: updatedReport.id,
                      brand_id: updatedReport.brand_id,
                      brand_name: updatedReport.brand_name,
                      brand_chinese_name: updatedReport.brand_chinese_name,
                      share_hash: updatedReport.share_hash,
                      data: JSON.parse(updatedReport.data),
                      generated_at: updatedReport.generated_at
                    }
                  });
                });
              }
            );
          });
        });
      }
    );
  });
});


// ==========================================
// ADMIN DASHBOARD ENDPOINTS
// ==========================================

// Get Operations & Financial Analytics (Real-time KPI metrics)
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = {
    totalMembers: 0,
    totalRevenue: 0.00,
    successTransactions: 0,
    pendingVerifications: 0
  };

  db.serialize(() => {
    // Total Registered Members
    db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
      if (row) stats.totalMembers = row.count;

      // Financials from Success Orders
      db.get("SELECT COUNT(*) as count, SUM(amount) as revenue FROM orders WHERE payment_status = 'Success'", [], (err, row) => {
        if (row) {
          stats.successTransactions = row.count;
          stats.totalRevenue = row.revenue || 0.00;
        }

        // Pending verifications count
        db.get("SELECT COUNT(*) as count FROM brands WHERE verification_status = 'pending'", [], (err, row) => {
          if (row) stats.pendingVerifications = row.count;
          
          res.json(stats);
        });
      });
    });
  });
});

// Get Brand Verification Claims list
app.get('/api/admin/claims', requireAdmin, (req, res) => {
  db.all("SELECT id, name, chinese_name, category, verification_license, verification_contact FROM brands WHERE verification_status = 'pending'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Process Verification Claim (Approve/Reject)
app.post('/api/admin/claims/action', requireAdmin, (req, res) => {
  const { brandId, action } = req.body; // action: 'approve' or 'reject'
  
  if (!brandId || !action) {
    return res.status(400).json({ error: 'Brand ID and action are required' });
  }

  const newStatus = action === 'approve' ? 'verified' : 'unverified';
  
  db.run(
    "UPDATE brands SET verification_status = ? WHERE id = ?",
    [newStatus, brandId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `Claim updated successfully. Brand has been set to ${newStatus}.` });
    }
  );
});

// Get Valuation Disputes Feedback List
app.get('/api/admin/disputes', requireAdmin, (req, res) => {
  db.all(`
    SELECT f.*, b.name as brand_name, b.chinese_name as brand_chinese_name, u.username as user_name 
    FROM valuation_feedback_log f
    JOIN brands b ON f.brand_id = b.id
    LEFT JOIN users u ON f.user_id = u.id
    ORDER BY f.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get Transaction Ledger Logs
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  db.all(`
    SELECT o.*, u.username as user_name, u.email as user_email, r.share_hash
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN reports r ON o.report_id = r.id
    ORDER BY o.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Setup topology node list mapping for interactive ECharts visual graphs
app.get('/api/graphs/topology', (req, res) => {
  db.serialize(() => {
    const data = {
      locations: [],
      brands: [],
      products: []
    };

    db.all("SELECT * FROM singapore_locations", [], (err, locations) => {
      data.locations = locations || [];

      db.all("SELECT id, name, chinese_name, category, cluster_type, calculated_valuation_usd, taobao_sales_volume, verification_status FROM brands", [], (err, brands) => {
        data.brands = brands || [];

        db.all("SELECT id, name, brand_id, category, singapore_location_ids FROM products", [], (err, products) => {
          data.products = products || [];

          res.json(data);
        });
      });
    });
  });
});

// Start Node server
initDatabase(() => {
  app.listen(PORT, () => {
    console.log(`Fintal full-stack platform running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} in your browser.`);
  });
});
