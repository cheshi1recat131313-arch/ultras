#!/usr/bin/env node
/**
 * Укрепляет альфа-канал портретов: полупрозрачные пиксели персонажа → непрозрачные.
 * Без внешних зависимостей (только Node zlib/fs).
 *
 * Использование: node scripts/solidify-portrait-alpha.js <png-path>
 */
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function readChunks(buf) {
    if (buf.toString("hex", 0, 8) !== "89504e470d0a1a0a") {
        throw new Error("Not a PNG file");
    }
    const chunks = [];
    let offset = 8;
    while (offset < buf.length) {
        const len = buf.readUInt32BE(offset);
        const type = buf.toString("ascii", offset + 4, offset + 8);
        const data = buf.subarray(offset + 8, offset + 8 + len);
        chunks.push({ type, data });
        offset += 12 + len;
        if (type === "IEND") break;
    }
    return chunks;
}

function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
    }
    return ~c >>> 0;
}

function writeChunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function unfilterRow(filter, row, prev, bpp, out, stride) {
    for (let i = 0; i < stride; i++) {
        const x = row[i];
        const a = i >= bpp ? out[i - bpp] : 0;
        const b = prev ? prev[i] : 0;
        const c = prev && i >= bpp ? prev[i - bpp] : 0;
        let v;
        switch (filter) {
            case 0:
                v = x;
                break;
            case 1:
                v = (x + a) & 0xff;
                break;
            case 2:
                v = (x + b) & 0xff;
                break;
            case 3:
                v = (x + Math.floor((a + b) / 2)) & 0xff;
                break;
            case 4:
                v = (x + paeth(a, b, c)) & 0xff;
                break;
            default:
                throw new Error(`Unknown filter ${filter}`);
        }
        out[i] = v;
    }
}

function decodeRgbaPng(buf) {
    const chunks = readChunks(buf);
    const ihdr = chunks.find((c) => c.type === "IHDR");
    if (!ihdr) throw new Error("Missing IHDR");
    const w = ihdr.data.readUInt32BE(0);
    const h = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data[8];
    const colorType = ihdr.data[9];
    if (bitDepth !== 8 || colorType !== 6) {
        throw new Error(`Only RGBA8 supported (got depth=${bitDepth} type=${colorType})`);
    }
    const idat = Buffer.concat(chunks.filter((c) => c.type === "IDAT").map((c) => c.data));
    const raw = zlib.inflateSync(idat);
    const bpp = 4;
    const stride = w * bpp;
    const pixels = Buffer.alloc(h * stride);
    let rawOff = 0;
    let prev = null;
    for (let y = 0; y < h; y++) {
        const filter = raw[rawOff++];
        const row = raw.subarray(rawOff, rawOff + stride);
        rawOff += stride;
        const outRow = pixels.subarray(y * stride, (y + 1) * stride);
        unfilterRow(filter, row, prev, bpp, outRow, stride);
        prev = outRow;
    }
    return { w, h, pixels, ihdr: ihdr.data, chunks };
}

function solidifyPixels(pixels, width, height) {
    const total = width * height;
    let changed = 0;
    for (let px = 0; px < total; px++) {
        const o = px * 4;
        const a = pixels[o + 3];
        if (a === 0 || a === 255) continue;
        const r = pixels[o];
        const g = pixels[o + 1];
        const b = pixels[o + 2];
        pixels[o] = Math.min(255, Math.round((r * 255) / a));
        pixels[o + 1] = Math.min(255, Math.round((g * 255) / a));
        pixels[o + 2] = Math.min(255, Math.round((b * 255) / a));
        pixels[o + 3] = 255;
        changed++;
    }
    return changed;
}

function encodeRgbaPng(w, h, pixels, ihdrData, chunks) {
    const bpp = 4;
    const stride = w * bpp;
    const rawParts = [];
    for (let y = 0; y < h; y++) {
        rawParts.push(Buffer.from([0]));
        rawParts.push(pixels.subarray(y * stride, (y + 1) * stride));
    }
    const raw = Buffer.concat(rawParts);
    const idat = zlib.deflateSync(raw, { level: 9 });

    const out = [Buffer.from("89504e470d0a1a0a", "hex")];
    out.push(writeChunk("IHDR", ihdrData));
    for (const chunk of chunks) {
        if (chunk.type === "IHDR" || chunk.type === "IDAT" || chunk.type === "IEND") continue;
        out.push(writeChunk(chunk.type, chunk.data));
    }
    out.push(writeChunk("IDAT", idat));
    out.push(writeChunk("IEND", Buffer.alloc(0)));
    return Buffer.concat(out);
}

function main() {
    const target = process.argv[2];
    if (!target) {
        console.error("Usage: node scripts/solidify-portrait-alpha.js <png-path>");
        process.exit(1);
    }
    const file = path.resolve(target);
    const buf = fs.readFileSync(file);
    const { w, h, pixels, ihdr, chunks } = decodeRgbaPng(buf);
    const changed = solidifyPixels(pixels, w, h);
    const out = encodeRgbaPng(w, h, pixels, ihdr, chunks);
    fs.writeFileSync(file, out);
    console.log(`OK ${file} (${w}x${h}, solidified ${changed} pixels)`);
}

module.exports = {
    decodeRgbaPng,
    encodeRgbaPng,
    solidifyPixels
};

if (require.main === module) {
    main();
}
