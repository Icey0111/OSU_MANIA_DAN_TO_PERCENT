/**
 * 自动同步 overlay HTML 到 tosu static 目录
 *
 * 用法:
 *   node scripts/sync-overlay.js --tosu "D:\tosu"
 *   node scripts/sync-overlay.js --watch
 *
 * 默认 tosu 路径会尝试以下位置:
 *   1. --tosu 参数
 *   2. 环境变量 TOSU_PATH
 *   3. 当前目录下的 tosu 文件夹
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ===== 配置 =====
const OVERLAY_NAME = "dan-voting";
const SOURCE_DIR = path.resolve(__dirname, "..", "overlay", OVERLAY_NAME);

// ===== 解析参数 =====
const args = process.argv.slice(2);
const tosuArg = args.find((a) => a.startsWith("--tosu="));
const tosuArgIndex = args.indexOf("--tosu");
const watchMode = args.includes("--watch") || args.includes("-w");

let tosuPath =
  tosuArg?.split("=")[1] ||
  (tosuArgIndex >= 0 ? args[tosuArgIndex + 1] : null) ||
  process.env.TOSU_PATH ||
  path.resolve(__dirname, "..", "tosu");

// ===== 核心：复制文件 =====
function sync() {
  const destDir = path.join(tosuPath, "static", OVERLAY_NAME);

  if (!fs.existsSync(tosuPath)) {
    console.error(
      `[ERROR] tosu 目录不存在: ${tosuPath}`
    );
    console.error("请用 --tosu=路径 指定 tosu 所在目录");
    process.exit(1);
  }

  // 创建目标目录
  fs.mkdirSync(destDir, { recursive: true });

  // Browser and in-game WebView have isolated storage. This installation ID
  // lets the API hand a fresh login to this specific local renderer.
  const installationIdPath = path.join(destDir, ".installation-id");
  let installationId = "";
  if (fs.existsSync(installationIdPath)) {
    installationId = fs.readFileSync(installationIdPath, "utf8").trim();
  }
  if (!/^[a-f0-9]{64}$/.test(installationId)) {
    installationId = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(installationIdPath, installationId, "utf8");
  }

  // 复制所有文件和资源目录
  const files = fs.readdirSync(SOURCE_DIR);
  for (const file of files) {
    const src = path.join(SOURCE_DIR, file);
    const dest = path.join(destDir, file);
    if (fs.statSync(src).isFile()) {
      if (file === "index.html") {
        const html = fs
          .readFileSync(src, "utf8")
          .replace("__DAN_VOTING_INSTALLATION_ID__", installationId);
        fs.writeFileSync(dest, html, "utf8");
      } else {
        fs.copyFileSync(src, dest);
      }
      console.log(`[OK] ${file} → ${destDir}`);
    } else if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true, force: true });
      console.log(`[OK] ${file}/ → ${destDir}`);
    }
  }

  const time = new Date().toLocaleTimeString();
  console.log(`[SYNC] ${time} — 同步完成`);
  console.log("");
  console.log("──────────────────────────────────────────");
  console.log(`  访问地址:  http://localhost:24050/${OVERLAY_NAME}/`);
  console.log("  (URL 中不要加 static/，tosu 会自动拼接)");
  console.log("──────────────────────────────────────────");
}

// ===== 首次同步 =====
console.log(`[INFO] 源目录: ${SOURCE_DIR}`);
console.log(`[INFO] tosu 目录: ${tosuPath}`);
console.log("");

sync();

// ===== 监视模式 =====
if (watchMode) {
  console.log("[WATCH] 正在监视文件变更... (Ctrl+C 退出)");
  fs.watch(SOURCE_DIR, { recursive: true }, (eventType, filename) => {
    if (filename) {
      console.log(`[WATCH] 检测到变更: ${filename}`);
      sync();
    }
  });
}
