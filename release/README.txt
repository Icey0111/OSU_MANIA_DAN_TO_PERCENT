osu!mania Dan Voting 覆盖层 — 用户安装指南
================================================

本工具用于在 osu!mania 游戏内显示段位投票覆盖层。
玩家可以在打图时对当前谱面进行段位（Dan）投票。

系统需求:
  - tosu (https://github.com/tosuapp/tosu)
  - osu! 游戏本体
  - Windows 10/11

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  快速安装（双击 install.bat）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 确保 tosu 正在运行
2. 双击 install.bat
3. 输入 tosu 安装目录（如 D:\tosu）
4. 安装完成后，在 OBS 中添加浏览器源:
   URL: http://localhost:24050/dan-voting/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  手动安装

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 将 dan-voting 文件夹复制到:
   <tosu目录>\static\dan-voting\

2. 在 OBS 中打开: http://localhost:24050/dan-voting/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  使用说明

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 在 osu! 中进入任意 mania 谱面
2. 覆盖层会自动检测当前谱面
3. 单击覆盖层中的"Login with osu!"登录
4. 选择段位（1-10 或 α-η）和等级（low/mid/high）
5. 点击 Submit 提交投票

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  开发者选项: sync-overlay.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

如果你需要修改覆盖层代码，可使用同步脚本:

  node sync-overlay.js --tosu "D:\tosu" --watch

修改 dan-voting/index.html 后会自动同步到 tosu。

需要 Node.js: https://nodejs.org/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  在线服务: https://osu-mania-dan-voting.top
  管理后台: https://osu-mania-dan-voting.top/admin
  项目仓库: https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT
