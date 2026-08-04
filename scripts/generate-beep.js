// One-off generator for assets/sounds/beep.wav (scanner confirmation tone).
// Usage: node scripts/generate-beep.js
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSec = 0.12;
const frequency = 1567.98; // G6 — crisp scanner beep
const amplitude = 0.5;

const sampleCount = Math.floor(sampleRate * durationSec);
const dataSize = sampleCount * 2; // 16-bit mono
const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20); // PCM
buffer.writeUInt16LE(1, 22); // mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < sampleCount; i++) {
  const t = i / sampleRate;
  const attack = Math.min(1, t / 0.005);
  const release = Math.min(1, (durationSec - t) / 0.03);
  const envelope = Math.min(attack, release);
  const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude * envelope;
  buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}

const outPath = path.join(__dirname, '..', 'assets', 'sounds', 'beep.wav');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log('Wrote', outPath, buffer.length, 'bytes');
