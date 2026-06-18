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

## 段位体系

| 数字段位 | 字母段位 |
|---------|---------|
| 1 ~ 10 | α, β, γ, δ, ε, ζ, η |

每个段位分为三个等级：**low** / **mid** / **high**

## 管理后台

管理员可通过 Web 后台查看谱面列表、投票统计、导出 CSV：

https://osu-mania-dan-to-percent.vercel.app/admin

（需 osu! 账号登录，管理员权限由后台分配）
