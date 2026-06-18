# osu!mania Dan Voting System

基于 Next.js 的 **osu!mania 谱面难度投票系统**，使用 DDMythical Reform Dan 4K 体系。玩家可以通过游戏内覆盖层对谱面进行段位（Dan）投票，管理员可在后台管理谱面和导出投票数据。

**在线地址:** https://osu-mania-dan-to-percent.vercel.app

**用户端下载:** [release.zip (v1.0.0)](https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT/releases/latest)

## 玩家使用（只安装覆盖层）

如果你只是想在游戏内使用投票覆盖层，不需要部署整个网站：

1. 下载 [最新 release.zip](https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT/releases/latest) 并解压
2. 确保 [tosu](https://github.com/tosuapp/tosu) 正在运行
3. 双击 `install.bat`，输入 tosu 目录
4. 在 OBS 中添加浏览器源: `http://localhost:24050/dan-voting/`

详细说明见 `README.txt`（包含在 zip 内）。

## 项目概览

```
                   浏览器 (Admin)                   游戏内覆盖层 (tosu)
                   ─────────────                    ──────────────────
                        │                                  │
                        ▼                                  ▼
               ┌─────────────────────────────────────────────────┐
               │              Next.js App (Vercel)               │
               │  /admin/*  (管理后台)   /api/*  (API 路由)       │
               └────────────────┬────────────────────────────────┘
                                │
                                ▼
               ┌─────────────────────────────────────────────────┐
               │              Supabase (PostgreSQL)              │
               │  users / beatmaps / votes / overlay_sessions    │
               └─────────────────────────────────────────────────┘
```

- **管理后台** (`/admin`): 通过 osu! OAuth 登录，查看谱面列表、投票统计、导出 CSV
- **覆盖层** (`overlay/dan-voting/`): 在 osu! 游戏内显示，玩家选择段位（1-10 或 α-η）和等级（low/mid/high）
- **API**: 投票提交、谱面查询、用户认证

## 前置要求

- **Node.js** >= 18
- **npm** 或 **yarn**
- **[tosu](https://github.com/tosuapp/tosu)** - osu! 内存读取器 + 本地服务器（用于覆盖层）
- **[Supabase](https://supabase.com)** 账号 - 云端 PostgreSQL 数据库
- **[osu! OAuth 应用](https://osu.ppy.sh/home/account/edit#oauth)** - 用于用户登录认证

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT.git
cd OSU_MANIA_DAN_TO_PERCENT
```

### 2. 配置数据库 (Supabase)

在 Supabase SQL Editor 中执行 `schema.sql`：

```bash
# 将 schema.sql 的全部内容复制到 Supabase 的 SQL Editor 中运行
```

或者在项目目录中使用 Supabase CLI：

```bash
supabase db push
```

### 3. 配置环境变量

```bash
cd next-app
cp .env.example .env.local
```

编辑 `.env.local`，填入以下值：

| 变量 | 说明 | 获取方式 |
|------|------|----------|
| `SUPABASE_URL` | Supabase 项目 URL | Supabase Dashboard → Settings → API |
| `SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务角色密钥 | 同上（⚠️ 保密，仅服务端使用） |
| `OSU_CLIENT_ID` | osu! OAuth 客户端 ID | [osu! Account Settings → OAuth](https://osu.ppy.sh/home/account/edit#oauth) |
| `OSU_CLIENT_SECRET` | osu! OAuth 客户端密钥 | 同上 |
| `OSU_REDIRECT_URI` | OAuth 回调地址 | `http://localhost:3000/api/auth/callback`（本地开发） |
| `JWT_SECRET` | JWT 签名密钥 | 随机字符串，例如: `openssl rand -hex 32` |

> **⚠️ 重要:** `SUPABASE_SERVICE_ROLE_KEY` 和 `OSU_CLIENT_SECRET` 是敏感信息，切勿提交到 Git。

### 4. 安装依赖并启动

```bash
npm install
npm run dev
```

打开 http://localhost:3000 查看页面，http://localhost:3000/admin 进入管理后台。

## 覆盖层设置 (tosu)

覆盖层让你在 osu! 游戏内看到投票界面，边打图边投票。

### 1. 同步覆盖层文件到 tosu

```bash
# 一次性同步
npm run sync-overlay -- --tosu "D:\tosu"

# 或者持续监听文件变更（推荐开发时使用）
npm run sync-overlay:watch -- --tosu "D:\tosu"
```

替换 `D:\tosu` 为你实际的 tosu 安装路径。也可以设置环境变量 `TOSU_PATH` 来避免每次指定路径。

### 2. 在 OBS / Streamlabs 中添加覆盖层

在浏览器源中添加 `http://localhost:24050/dan-voting/`。

### 3. 登录

点击覆盖层中的"Login with osu!"按钮完成 osu! OAuth 登录，登录后即可提交投票。

## 项目结构

```
OSU_MANIA_DAN_TO_PERCENT/
├── next-app/                    # Next.js 14 App Router 应用
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/           # 管理后台页面
│   │   │   │   ├── login/       # osu! OAuth 登录页
│   │   │   │   ├── beatmaps/    # 谱面列表 & 详情（含投票图表）
│   │   │   │   └── page.tsx     # 管理后台仪表盘
│   │   │   └── api/             # API 路由
│   │   │       ├── auth/        # 认证接口 (login/callback/me/logout)
│   │   │       ├── votes/       # 投票接口 (POST 提交投票)
│   │   │       ├── beatmaps/    # 谱面接口 (GET 投票分布)
│   │   │       └── admin/       # 管理接口 (dashboard/export/beatmaps)
│   │   ├── lib/
│   │   │   ├── auth.ts          # JWT 签名/验证
│   │   │   ├── osu.ts           # osu! OAuth v2 辅助函数 (PKCE)
│   │   │   ├── db.ts            # Supabase 客户端
│   │   │   └── validation.ts    # 段位/等级定义
│   │   └── middleware.ts        # 认证中间件 + CORS
│   ├── .env.example             # 环境变量模板
│   └── package.json
├── overlay/dan-voting/          # 覆盖层 (纯 HTML/CSS/JS, 无构建)
│   └── index.html
├── scripts/sync-overlay.js      # 覆盖层同步脚本
└── schema.sql                   # 数据库建表语句
```

## 数据库 Schema

| 表 | 用途 |
|----|------|
| `users` | 已认证的 osu! 玩家 (osu_id, 用户名, 头像, 管理员标记) |
| `beatmaps` | 谱面元数据 (谱面 ID, 曲师, 标题, 难度名, 创作者, 总票数) |
| `votes` | 投票记录 (用户ID, 谱面ID, 段位, 等级) - 每用户每谱面仅一票 |
| `overlay_auth_sessions` | 浏览器→游戏内登录移交 (短暂存活的 JWT) |

## 段位体系

```
段位: 1 → 2 → 3 → ... → 10 → α (Alpha) → β (Beta) → γ (Gamma) → δ (Delta) → ε (Epsilon) → ζ (Zeta) → η (Eta)
等级: low / mid / high
```

## 部署 (Vercel)

本项目的 Next.js 部分可直接部署到 Vercel：

1. Fork 本项目到你的 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 在 Vercel 项目设置中配置所有环境变量（与 `.env.example` 一致）
4. 部署完成后，更新覆盖层 `index.html` 中的 `API_BASE` 为你的 Vercel 域名

## 技术栈

| 技术 | 用途 |
|------|------|
| **Next.js 14** (App Router) | 全栈框架 |
| **React 18** | UI 组件 |
| **TypeScript** | 类型安全 |
| **Tailwind CSS** | 样式 |
| **Supabase** (PostgreSQL) | 数据库 |
| **jose** | JWT 签名/验证 |
| **Recharts** | 投票分布图表 |
| **tosu WebSocket** | 获取游戏内当前谱面 |
| **osu! OAuth v2 + PKCE** | 用户认证 |

## 许可证

MIT
