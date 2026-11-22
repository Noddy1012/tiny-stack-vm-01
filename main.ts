import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Tiny stack VM for make.fun's tiny-stack-vm-01 ISA. One run answers a whole
// set: for each /input/<id>/ it runs program.bin on input.bin and writes
// /output/<id>/stdout.bin and /output/<id>/exit.txt. Node 22, no deps.
const MS = 1e6, NS = 256, NC = 64, NM = 256, NO = 65536;
const IMM = new Int8Array(256).fill(-1), PO = new Int8Array(256), PU = new Int8Array(256);
for (let o = 16; o < 35; o++) { if (o !== 31) { IMM[o] = 0; PO[o] = o === 23 || o === 27 ? 1 : 2; PU[o] = 1; } }
for (const a of [[0, 0, 0, 0], [1, 0, 1, 1], [2, 0, 1, 4], [3, 1, 0, 0], [4, 1, 2, 0], [5, 2, 2, 0], [6, 2, 3, 0], [7, 3, 3, 0], [48, 0, 0, 2], [49, 1, 0, 2], [50, 1, 0, 2], [51, 0, 0, 2], [52, 0, 0, 0], [64, 1, 1, 0], [65, 2, 0, 0], [80, 1, 0, 0], [81, 1, 0, 0], [82, 0, 1, 0], [83, 1, 0, 0]]) { IMM[a[0]] = a[3]; PO[a[0]] = a[1]; PU[a[0]] = a[2]; }
function run(p, inp) {
  const st = new Int32Array(NS), cs = new Int32Array(NC), mem = new Int32Array(NM), out = Buffer.allocUnsafe(NO), n = p.length;
  let sp = 0, cp = 0, pc = 0, steps = 0, ip = 0, ol = 0, code = -1;
  while (code < 0) {
    if (steps >= MS) { code = 10; break; }
    if (pc < 0 || pc >= n) { code = 9; break; }
    const op = p[pc], il = IMM[op];
    if (il < 0) { code = 5; break; }
    if (pc + 1 + il > n) { code = 9; break; }
    if (sp < PO[op]) { code = 2; break; }
    if (sp - PO[op] + PU[op] > NS) { code = 3; break; }
    steps++;
    const p0 = pc, npc = pc + 1 + il;
    pc = npc;
    switch (op) {
      case 0: code = 0; break;
      case 1: st[sp++] = (p[p0 + 1] << 24) >> 24; break;
      case 2: st[sp++] = p[p0 + 1] | (p[p0 + 2] << 8) | (p[p0 + 3] << 16) | (p[p0 + 4] << 24); break;
      case 3: sp--; break;
      case 4: st[sp] = st[sp - 1]; sp++; break;
      case 5: { const t = st[sp - 1]; st[sp - 1] = st[sp - 2]; st[sp - 2] = t; break; }
      case 6: st[sp] = st[sp - 2]; sp++; break;
      case 7: { const a = st[sp - 3]; st[sp - 3] = st[sp - 2]; st[sp - 2] = st[sp - 1]; st[sp - 1] = a; break; }
      case 16: { const b = st[--sp]; st[sp - 1] = (st[sp - 1] + b) | 0; break; }
      case 17: { const b = st[--sp]; st[sp - 1] = (st[sp - 1] - b) | 0; break; }
      case 18: { const b = st[--sp]; st[sp - 1] = Math.imul(st[sp - 1], b); break; }
      case 19: { const b = st[--sp], a = st[sp - 1]; if (!b) { code = 4; break; } st[sp - 1] = (a / b) | 0; break; }
      case 20: { const b = st[--sp], a = st[sp - 1]; if (!b) { code = 4; break; } st[sp - 1] = a % b; break; }
      case 21: { const b = st[--sp], a = st[sp - 1], u = b >>> 0; if (!u) { code = 4; break; } st[sp - 1] = Math.floor((a >>> 0) / u) | 0; break; }
      case 22: { const b = st[--sp], a = st[sp - 1], u = b >>> 0; if (!u) { code = 4; break; } st[sp - 1] = ((a >>> 0) % u) | 0; break; }
      case 23: st[sp - 1] = (-st[sp - 1]) | 0; break;
      case 24: { const b = st[--sp]; st[sp - 1] &= b; break; }
      case 25: { const b = st[--sp]; st[sp - 1] |= b; break; }
      case 26: { const b = st[--sp]; st[sp - 1] ^= b; break; }
      case 27: st[sp - 1] = ~st[sp - 1]; break;
      case 28: { const b = st[--sp]; st[sp - 1] <<= b & 31; break; }
      case 29: { const b = st[--sp]; st[sp - 1] >>= b & 31; break; }
      case 30: { const b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> (b & 31)) | 0; break; }
      case 32: { const b = st[--sp]; st[sp - 1] = st[sp - 1] === b ? 1 : 0; break; }
      case 33: { const b = st[--sp]; st[sp - 1] = st[sp - 1] < b ? 1 : 0; break; }
      case 34: { const b = st[--sp]; st[sp - 1] = (st[sp - 1] >>> 0) < (b >>> 0) ? 1 : 0; break; }
      case 48: pc = npc + (((p[p0 + 1] | (p[p0 + 2] << 8)) << 16) >> 16); break;
      case 49: { const v = st[--sp]; if (!v) pc = npc + (((p[p0 + 1] | (p[p0 + 2] << 8)) << 16) >> 16); break; }
      case 50: { const v = st[--sp]; if (v) pc = npc + (((p[p0 + 1] | (p[p0 + 2] << 8)) << 16) >> 16); break; }
      case 51: if (cp >= NC) { code = 7; break; } cs[cp++] = npc; pc = p[p0 + 1] | (p[p0 + 2] << 8); break;
      case 52: if (!cp) { code = 8; break; } pc = cs[--cp]; break;
      case 64: { const a = st[sp - 1]; if (a < 0 || a >= NM) { code = 6; break; } st[sp - 1] = mem[a]; break; }
      case 65: { const a = st[--sp], v = st[--sp]; if (a < 0 || a >= NM) { code = 6; break; } mem[a] = v; break; }
      case 80: { const v = st[--sp], s = String(v); if (ol + s.length > NO) { code = 11; break; } out.write(s, ol, s.length, 'ascii'); ol += s.length; break; }
      case 81: { const v = st[--sp]; if (ol + 1 > NO) { code = 11; break; } out[ol++] = v & 255; break; }
      case 82: st[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: code = st[--sp] & 255; break;
      default: code = 5;
    }
  }
  return { code, out: out.subarray(0, ol) };
}
const read0 = (f) => { try { return readFileSync(f); } catch { return Buffer.alloc(0); } };
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const e of readdirSync(I, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const r = run(read0(join(I, e.name, 'program.bin')), read0(join(I, e.name, 'input.bin')));
  mkdirSync(join(O, e.name), { recursive: true });
  writeFileSync(join(O, e.name, 'stdout.bin'), r.out);
  writeFileSync(join(O, e.name, 'exit.txt'), r.code + '\n');
}
