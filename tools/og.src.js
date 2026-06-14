// SOURCE for functions/og.js — bundled with esbuild into a self-contained file.
// Do not edit functions/og.js by hand; edit this source and re-bundle.
import satori from "satori";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

const SITE = "notes.maijun.net";
const BRAND = "maijun の技術質問ノート";
const FONT_PATH = "/assets/og/noto-sans-jp-bold-subset.otf";
const WASM_PATH = "/assets/og/resvg.wasm";
const TITLE_MAX = 48;

let wasmReady;
let fontCache;

function ensureWasm(origin) {
  if (!wasmReady) {
    wasmReady = fetch(new URL(WASM_PATH, origin))
      .then((r) => {
        if (!r.ok) throw new Error(`wasm fetch failed: ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => initWasm(buf));
  }
  return wasmReady;
}

async function loadFont(origin) {
  if (!fontCache) {
    const res = await fetch(new URL(FONT_PATH, origin));
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
    const title = clampTitle(url.searchParams.get("title"));
    const [, font] = await Promise.all([ensureWasm(url.origin), loadFont(url.origin)]);

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
    return new Response(`OG image error: ${err && err.message ? err.message : err}`, {
      status: 500, headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}
