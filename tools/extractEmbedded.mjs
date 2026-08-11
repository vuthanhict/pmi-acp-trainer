/* Giải nén 3 payload gzip+base64 trong src/lib/embeddedData.js ra thư mục data/ để chỉnh sửa
   bằng tay hoặc bằng script. Chạy: node tools/extractEmbedded.mjs */
import fs from "fs";
import zlib from "zlib";

const SRC = "src/lib/embeddedData.js";
export const PAYLOADS = {
  QUIZ_EMBED_GZ_B64: "data/quiz-embed.json",
  VI_TERMBASE_GZ_B64: "data/vi-termbase.json",
  VI_ENRICHMENT_GZ_B64: "data/vi-enrichment.json",
};

export function readPayload(name) {
  const src = fs.readFileSync(SRC, "utf8");
  const m = src.match(new RegExp(`${name} = "([^"]+)"`));
  if (!m) throw new Error(`payload not found: ${name}`);
  return JSON.parse(zlib.gunzipSync(Buffer.from(m[1], "base64")).toString());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [name, out] of Object.entries(PAYLOADS)) {
    fs.writeFileSync(out, JSON.stringify(readPayload(name), null, 1));
    console.log("wrote", out);
  }
}
