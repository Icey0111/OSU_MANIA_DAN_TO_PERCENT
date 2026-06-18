osu!mania Dan Voting - 用户安装指南
=====================================

本工具通过 tosu 读取当前 osu!mania 谱面，并显示段位投票覆盖层。

系统要求
--------

- Windows 10 或 Windows 11
- osu!
- tosu: https://github.com/tosuapp/tosu
- 可用的网络连接

自动安装
--------

1. 将 Release.zip 完整解压。
2. 启动 tosu。
3. 双击 install.bat。
4. 如果没有自动检测到 tosu，请输入包含 tosu.exe 的文件夹。
5. 安装完成后打开：

   http://localhost:24050/dan-voting/

OBS 使用方法
------------

在 OBS 中添加“浏览器”源，并将 URL 设置为：

http://localhost:24050/dan-voting/

登录与投票
----------

1. 在普通浏览器中打开上面的本地地址。
2. 点击 Login with osu! 并完成授权。
3. 在 osu! 中选择一个 mania 谱面。
4. 等待覆盖层显示当前谱面。
5. 选择段位以及 low、mid 或 high。
6. 点击 Submit Vote。

浏览器登录状态同步到游戏内覆盖层可能需要几秒钟。

手动安装
--------

将 dan-voting 文件夹复制到：

<tosu目录>\static\dan-voting\

注意：手动复制不会自动生成登录同步所需的安装标识。推荐使用 install.bat。

常见问题
--------

1. 页面打不开
   确认 tosu 正在运行，地址中不需要加入 static。

2. 游戏内显示未登录
   在普通浏览器中打开本地页面重新登录，等待几秒后按 F5 刷新。

3. 没有显示谱面
   确认当前谱面为 osu!mania 模式，并确认 tosu 能读取游戏状态。

4. 投票失败
   检查网络和登录状态。系统只允许 osu! 官方 API 能确认的 mania 谱面。

相关链接
--------

在线服务: https://osu-mania-dan-voting.top
项目仓库: https://github.com/Icey0111/OSU_MANIA_DAN_TO_PERCENT
