# Fintal - Chinese Brand Valuation & Topology Platform

[English](#english) | [中文](#中文)

---

## 中文

本项目为 **北京小米咖啡设备有限公司** (`www.xiaomicafe.net`) 开发的中国出海品牌估值、权属核验及新加坡零售渠道图谱系统。

### 功能亮点
1. **中国制造品牌追踪（新加坡）**：搜索并筛选目前可在新加坡购买的中国制造出海品牌。
2. **10维估值数学模型**：涵盖线下门店、社媒互动、跨境销量、PCT专利、搜索意向、媒体声量、合规认证、好评率、海关贸易量及溢价率。
3. **品牌确权与估值申诉**：品牌商可上传企业证书（如营业执照）进行认领；已验证商户可调节指标，若对估值有异议，可通过结构化申诉流程反馈。
4. **加密分享与7元微支付围栏**：生成专属加密分享链接。未登录或非付费用户访问时，自动拦截并提示完成注册和 7 元人民币（微信支付/支付宝）的模拟小额支付以解锁完整报告。
5. **神经网络特征拓扑图**：使用 ECharts.js 构建互动拓扑图，展示新加坡零售渠道连接关系以及出海品牌估值矩阵。
6. **运营与财务看板**：管理员可审核所有认领请求、查看估值异议记录并审计交易支付流水。
7. **容灾双模式运行**：
   - **全栈 Node.js 模式**：通过 SQLite 数据库进行数据交互与 API 管理。
   - **离线沙箱模式**：若本地未安装 Node.js，直接在浏览器中双击打开 `public/index.html`，系统会自动切换为 `localStorage` 模拟数据库，**所有交互、支付、雷达图、管理员模块均可完整运行调试**。

### 安装与运行

#### 方式一：Node.js 服务器运行（推荐）
1. 确保本地安装了 [Node.js](https://nodejs.org/)。
2. 打开终端，进入本项目根目录：
   ```bash
   cd Fintal
   ```
3. 安装依赖包：
   ```bash
   npm install
   ```
4. 启动服务：
   ```bash
   npm start
   ```
5. 在浏览器中访问：`http://localhost:3000`

#### 方式二：直接浏览器双击打开（离线沙箱）
- 直接在浏览器中打开 `public/index.html` 即可开始交互体验。

---

## English

Fintal is an overseas brand valuation, verification, and retail topology suite for **Beijing Xiaomi Coffee Equipment Co., Ltd.** (`www.xiaomicafe.net`).

### Features
1. **"Made in China" Brands Tracker**: Search and filter manufacturing brands available in Singapore.
2. **10-Dimensional Valuation Model**: Integrates offline stores, social interactions, cross-border e-commerce, PCT patents, Google Trends, media share, certifications, ratings, custom trades, and premium indices.
3. **Verification & Dispute Loop**: Brand owners upload credentials to claim profiles, adjust metrics, or submit structured dispute feedback.
4. **Paywall Gate**: Shared report link triggers a paywall requiring a simulated 7 RMB WeChat/Alipay fee and member registration to unlock.
5. **Interactive Synaptic Topologies**: Visualizes Singapore retail nodes and brand status clusters using ECharts.js force-directed graphs.
6. **Operations Admin Dashboard**: Allows administrators to approve claims, view text disputes, and audit financial ledgers.
7. **Dual-Mode System**: Runs as a Node.js + Express + SQLite app, or gracefully falls back to a browser-only `localStorage` simulation if launched via `file://` protocol.

### Installation & Run

#### Option 1: Full-Stack Mode (Requires Node.js)
1. Ensure [Node.js](https://nodejs.org/) is installed.
2. Navigate to the project root:
   ```bash
   cd Fintal
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open browser at: `http://localhost:3000`

#### Option 2: Browser Simulation Mode
- Simply double-click `public/index.html` to run the fully functioning application offline.
