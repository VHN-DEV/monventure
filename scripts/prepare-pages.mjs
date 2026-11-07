// SPDX-FileCopyrightText: 2026 V.H.Nam
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Prepares the `dist` folder for publishing on GitHub Pages:
 * - Replaces the assets that may not be reused (`LicenseRef-NO-REUSE` in `assets/REUSE.toml`), along with the event
 *   variants of the logo, with blank placeholders.
 * - Makes the web app manifest work from the `/monventure/` sub-path, instead of the domain root.
 */

import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { crc32, deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TRANSPARENT = [0, 0, 0, 0];
/** Matches the `theme_color` of the web app manifest */
const ICON_GRAY = [0x8c, 0x8c, 0x8c, 0xff];

function pngChunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** @returns A PNG of the given size, filled with a single RGBA color */
function solidPng(width, height, color) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6], 8); // 8 bits per channel, RGBA

  // Each row starts with a filter type byte (0 = none)
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 4, Buffer.from(color))]);
  const pixels = Buffer.concat(new Array(height).fill(row));

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("dist/images/logo.png", solidPng(150, 33, TRANSPARENT));
writeFileSync("dist/images/logo_fake.png", solidPng(150, 33, TRANSPARENT));
for (const file of readdirSync("dist/images/events").filter(name => name.startsWith("logo_"))) {
  writeFileSync(`dist/images/events/${file}`, solidPng(150, 33, TRANSPARENT));
}
writeFileSync("dist/logo128.png", solidPng(128, 128, ICON_GRAY));
writeFileSync("dist/logo512.png", solidPng(512, 512, ICON_GRAY));
rmSync("dist/images/intro_dark.mp4");

const manifest = JSON.parse(readFileSync("dist/manifest.webmanifest", "utf8"));
writeFileSync("dist/manifest.webmanifest", JSON.stringify({ ...manifest, scope: "./", start_url: "./" }));
