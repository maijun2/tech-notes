// Cloudflare Pages Function — 動的 OGP 画像生成
//
// ルート:  GET /og?title=記事タイトル
// 出力:    1200x630 PNG（OGP 標準サイズ）
//
// 仕組み:
//   satori        … HTML/CSS 風のレイアウトツリー → SVG（テキストはパス化される）
//   resvg-wasm    … SVG → PNG ラスタライズ（WASM）
//   日本語フォント … assets/og/ に置いたサブセット版 Noto Sans JP を実行時に fetch
//
// 依存は package.json で管理（Cloudflare Pages が自動で npm install する）。
// resvg の WASM はバンドルに取り込み、フォントは静的アセットとして取得する。

// satori はモジュール評価時に `process` を参照するが、Workers ランタイムには
// (nodejs_compat を有効にしない限り)`process` グローバルが無い。
// ESM は import を記述順に評価するため、satori より前に shim を import して
// `process` を定義しておく(ダッシュボードでの互換フラグ設定を不要にする)。
import "./_process-shim.js";
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
// .wasm の import は Pages Functions のバンドラが WebAssembly.Module として解決する
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

const SITE = "notes.maijun.net";
const BRAND = "maijun の技術質問ノート";
const FONT_PATH = "/assets/og/noto-sans-jp-bold-subset.otf";
const TITLE_MAX = 48; // これを超えたら末尾を … で省略（630px に収めるため）

// isolate 内で 1 度だけ初期化・取得してキャッシュする
let wasmReady;
let fontCache;

function ensureWasm() {
  if (!wasmReady) wasmReady = initWasm(resvgWasm);
  return wasmReady;
}

async function loadFont(origin) {
  if (!fontCache) {
    const res = await fetch(new URL(FONT_PATH, origin), {
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
    fontCache = await res.arrayBuffer();
  }
  return fontCache;
}

function clampTitle(raw) {
  const t = (raw || "").replace(/\s+/g, " ").trim();
  if (!t) return BRAND;
  return [...t].length > TITLE_MAX ? [...t].slice(0, TITLE_MAX - 1).join("") + "…" : t;
}

// satori が受け取るレイアウトツリー（JSX を使わず素のオブジェクトで記述）
function ogTree(title) {
  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0f172a",
        padding: "72px",
        fontFamily: "Noto Sans JP",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", color: "#38bdf8", fontSize: "34px", letterSpacing: "0.04em" },
            children: SITE,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              color: "#f1f5f9",
              fontSize: "64px",
              lineHeight: 1.35,
              maxWidth: "1056px",
            },
            children: title,
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", color: "#94a3b8", fontSize: "28px" },
            children: BRAND,
          },
        },
      ],
    },
  };
}

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const title = clampTitle(url.searchParams.get("title"));

    const [, font] = await Promise.all([ensureWasm(), loadFont(url.origin)]);

    const svg = await satori(ogTree(title), {
      width: 1200,
      height: 630,
      fonts: [{ name: "Noto Sans JP", data: font, weight: 700, style: "normal" }],
    });

    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
      .render()
      .asPng();

    return new Response(png, {
      headers: {
        "content-type": "image/png",
        // SNS クローラ向けに長めにキャッシュ（タイトルが変わると URL も変わるため安全）
        "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch (err) {
    return new Response(`OG image error: ${err && err.message ? err.message : err}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
