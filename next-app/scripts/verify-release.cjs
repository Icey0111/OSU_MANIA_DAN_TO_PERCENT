const fs = require("fs");
const path = require("path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  module._compile(output, filename);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const confidence = require("../src/lib/confidence.ts");
const { DAN_LEVELS } = require("../src/lib/validation.ts");
const [rank10, alpha, beta, , delta] = DAN_LEVELS.slice(9);
const count = (value) => ({ low: value, mid: 0, high: 0 });

const empty = confidence.analyzeConfidence({});
assert(empty.stage === "empty", "Empty confidence stage failed");
assert(Object.keys(confidence.buildInGameDistribution({}, empty)).length === 0, "Empty render failed");

const tiedDistribution = { [rank10]: count(1), [alpha]: count(1), [beta]: count(1) };
const tied = confidence.analyzeConfidence(tiedDistribution);
assert(tied.stage === "tied" && tied.leading_ranks.length === 3, "Provisional tie failed");
assert(Object.keys(confidence.buildInGameDistribution(tiedDistribution, tied)).length === 3, "Tied render failed");

const provisionalDistribution = { [rank10]: count(1), [alpha]: count(2), [beta]: count(1) };
const provisional = confidence.analyzeConfidence(provisionalDistribution);
assert(provisional.stage === "provisional" && provisional.baseline_rank === alpha, "Provisional leader failed");
assert(provisional.ranks[delta] === "pending", "Provisional voting must remain open");
assert(Object.keys(confidence.buildInGameDistribution(provisionalDistribution, provisional)).length === 1, "Provisional render failed");

const establishedDistribution = { [rank10]: count(5), [alpha]: count(50), [beta]: count(5) };
const established = confidence.analyzeConfidence(establishedDistribution);
assert(established.stage === "established" && established.active, "Established baseline failed");
assert(established.ranks[delta] === "rejected", "Distant rank rejection failed");
assert(Object.keys(confidence.buildInGameDistribution(establishedDistribution, established)).length === 1, "Established render failed");

const root = path.resolve(__dirname, "..", "..");
const sourceOverlay = fs.readFileSync(path.join(root, "overlay", "dan-voting", "index.html"));
const releaseOverlay = fs.readFileSync(path.join(root, "release", "dan-voting", "index.html"));
assert(sourceOverlay.equals(releaseOverlay), "Release overlay is out of sync");
const html = sourceOverlay.toString("utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];
assert(script, "Overlay script was not found");
new Function(script);

const installer = fs.readFileSync(path.join(root, "release", "install.bat"));
assert([...installer].every((byte) => byte < 128), "Installer must remain ASCII-only");
assert(html.includes("__DAN_VOTING_INSTALLATION_ID__"), "Overlay installation placeholder is missing");

console.log("release-verification=passed");
