// SOURCE for functions/og.js — bundled with esbuild into a self-contained file.
// Do not edit functions/og.js by hand; edit this source and run `npm run build:og`.
//
// Cloudflare Workers forbids compiling WASM from bytes at runtime
// ("Wasm code generation disallowed by embedder"). So both WASM modules are
// imported as STATIC modules (compiled at deploy time by Pages) and instantiated
// from the precompiled WebAssembly.Module — which is allowed.
//   - satori: use the `standalone` build (no auto yoga) + init(yogaModule)
//   - resvg : initWasm(resvgModule)
// The `.wasm` imports below are kept EXTERNAL by esbuild (--external:*.wasm) and
// resolved by Pages relative to functions/og.js → functions/{yoga,resvg}.wasm.
import satori, { init as initSatori } from "satori/standalone";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import yogaWasm from "./yoga.wasm";
import resvgWasm from "./resvg.wasm";

const SITE = "notes.maijun.net";
const BRAND = "maijun の技術質問ノート";
const FONT_PATH = "/assets/og/noto-sans-jp-bold-subset.otf";
const NOTES_PATH = "/notes.json";
const TITLE_MAX = 48;

// 記事タイトル(notes.json)以外に /og を正当に呼ぶ固定ページのタイトル。
// index / 各カテゴリ / search ページの og:image はこれらを title= に持つ。
const EXTRA_TITLES = [BRAND, "AWS の記事", "OCI の記事", "その他の記事", "検索"];

let initReady;
let fontCache;
let allowedTitlesCache;

// Instantiate both WASM modules once per isolate (from precompiled Modules → no codegen).
function ensureInit() {
  if (!initReady) {
    initReady = Promise.all([initSatori(yogaWasm), initWasm(resvgWasm)]);
  }
  return initReady;
}

async function loadFont(origin) {
  if (!fontCache) {
    // フェイルセーフ: フォント取得が遅延しても Function がハングしないよう 3 秒で打ち切る。
    // タイムアウト時は AbortError が throw され、onRequestGet の catch で 500 にまとめる。
    const res = await fetch(new URL(FONT_PATH, origin), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    fontCache = await res.arrayBuffer();
  }
  return fontCache;
}

// 照合用の正規化: 全角/半角の括弧・記号や空白の揺れを吸収する(NFKC + 空白畳み込み)。
// 例: 全角「(」U+FF08 → 半角「(」、全角「?」U+FF1F → 半角「?」。
function normalizeTitle(raw) {
  return (raw || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

// Cache DoS 対策の許可リスト: notes.json の記事タイトル + 固定ページタイトルを
// 正規化した集合を、isolate 内に一度だけ構築してキャッシュする。
// notes.json が取得できない場合は throw し、onRequestGet 側で 500 にまとめる
// (許可リスト未確定のまま正当な記事を 403 にしないため。失敗はキャッシュしない)。
async function loadAllowedTitles(origin) {
  if (allowedTitlesCache) return allowedTitlesCache;
  const res = await fetch(new URL(NOTES_PATH, origin), { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`notes.json fetch failed: ${res.status}`);
  const notes = await res.json();
  const set = new Set(EXTRA_TITLES.map(normalizeTitle));
  if (Array.isArray(notes)) {
    for (const n of notes) {
      if (n && typeof n.title === "string") set.add(normalizeTitle(n.title));
    }
  }
  allowedTitlesCache = set;
  return allowedTitlesCache;
}

function clampTitle(raw) {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t) return BRAND;
  return [...t].length > TITLE_MAX ? [...t].slice(0, TITLE_MAX - 1).join("") + "…" : t;
}

function ogTree(title) {
  return {
    type: "div",
    props: {
      style: {
        width: "1200px", height: "630px", display: "flex", flexDirection: "column",
        justifyContent: "space-between", backgroundColor: "#0f172a", padding: "72px",
        fontFamily: "Noto Sans JP",
      },
      children: [
        { type: "div", props: { style: { display: "flex", color: "#38bdf8", fontSize: "34px", letterSpacing: "0.04em" }, children: SITE } },
        { type: "div", props: { style: { display: "flex", color: "#f1f5f9", fontSize: "64px", lineHeight: 1.35, maxWidth: "1056px" }, children: title } },
        { type: "div", props: { style: { display: "flex", color: "#94a3b8", fontSize: "28px" }, children: BRAND } },
      ],
    },
  };
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const requested = url.searchParams.get("title");
    // 未指定/空はトップページ画像(BRAND)として扱う(従来挙動を維持)。
    const titleParam = requested == null || requested.trim() === "" ? BRAND : requested;

    // Cache DoS 対策: レンダリングは notes.json + 固定ページの「既知タイトル」に限定する。
    // 任意のユニークタイトルでエッジキャッシュをすり抜け、高コストな描画(satori+resvg)を
    // 強制する攻撃を防ぐ。高コスト処理の前に検証し、不一致は 403 で即時に弾く。
    const allowed = await loadAllowedTitles(url.origin);
    if (!allowed.has(normalizeTitle(titleParam))) {
      return new Response("Forbidden", {
        status: 403, headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    const title = clampTitle(titleParam);
    const [, font] = await Promise.all([ensureInit(), loadFont(url.origin)]);

    const svg = await satori(ogTree(title), {
      width: 1200, height: 630,
      fonts: [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }],
    });
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();

    return new Response(png, {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch (err) {
    // 内部エラーの詳細はサーバログにのみ残し、クライアントには汎用メッセージだけ返す
    // (スタックや内部パス等を露出させない)。
    console.error("OG image generation failed:", err);
    return new Response("Internal Server Error", {
      status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
