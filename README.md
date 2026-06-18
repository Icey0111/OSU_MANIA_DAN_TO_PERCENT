# osu!mania Dan Voting

osu!mania 谱面段位投票覆盖层。在游戏内对当前谱面进行难度评定，使用 DDMythical Reform Dan 4K 体系。

## 下载安装

1. 下载 [release.zip](https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT/releases/latest) 并解压
2. 确保 [tosu](https://github.com/tosuapp/tosu) 正在运行
3. 双击 `install.bat`，按提示输入 tosu 安装目录
4. 在 OBS 中添加浏览器源：`http://localhost:24050/dan-voting/`

详细说明见 zip 内的 `README.txt`。

## 使用方法

1. 在 osu! 中进入任意 **mania** 谱面
2. 覆盖层自动检测当前谱面并显示投票界面
3. 点击 **Login with osu!** 登录 osu! 账号
4. 选择段位和等级后点击 **Submit** 提交投票

## 项目架构

```
               浏览器 / OBS                      游戏内覆盖层 (tosu)
               ─────────────                     ──────────────────
                     │                                   │
                     ▼                                   ▼
            ┌─────────────────────────────────────────────────┐
            │           Next.js App (Vercel)                  │
            │  /admin (管理后台)    /api (投票/认证接口)        │
            └────────────────────┬────────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────────┐
            │              Supabase (PostgreSQL)              │
            └─────────────────────────────────────────────────┘
```

- **覆盖层**: 在 osu! 游戏内显示，玩家选择段位和等级进行投票
- **管理后台**: osu! OAuth 登录，查看谱面列表、投票统计、导出 CSV
- **API**: JWT 鉴权的投票提交、谱面查询、用户认证

## 段位体系

| 数字段位 | 字母段位 |
|---------|---------|
| 1 ~ 10 | α, β, γ, δ, ε, ζ, η |

每个段位分为三个等级：**low** / **mid** / **high**

## 管理后台

管理员可通过 Web 后台查看谱面列表、投票统计、导出 CSV：

https://osu-mania-dan-to-percent.vercel.app/admin

（需 osu! 账号登录，管理员权限由后台分配）

## 技术栈

| 技术 | 用途 |
|------|------|
| Next.js 14 (App Router) | 全栈框架 |
| React 18 | UI 组件 |
| TypeScript | 类型安全 |
| Tailwind CSS | 样式 |
| Supabase (PostgreSQL) | 数据库 |
| jose | JWT 签名/验证 |
| Recharts | 投票分布图表 |
| tosu WebSocket | 获取游戏内当前谱面 |
| osu! OAuth v2 + PKCE | 用户认证 |
