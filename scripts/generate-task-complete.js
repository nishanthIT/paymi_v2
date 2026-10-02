// One-off generator for assets/sounds/task-complete.wav (task completion chime).
// Usage: node scripts/generate-task-complete.js
const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const durationSec = 0.55;
const amplitude = 0.32;
// Two soft bell notes a fifth apart (E6 → B6) for a bright "ding-ding".
const notes = [
  { frequency: 1318.51, start: 0, decay: 7 },
  { frequency: 1975.53, start: 0.09, decay: 6 },
];

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
  let sample = 0;
  for (const note of notes) {
    const local = t - note.start;
    if (local < 0) continue;
    const attack = Math.min(1, local / 0.004);
    const envelope = attack * Math.exp(-note.decay * local);
    // Fundamental plus a quiet octave partial gives a bell-like timbre.
    sample +=
      envelope *
      (Math.sin(2 * Math.PI * note.frequency * local) +
        0.25 * Math.sin(2 * Math.PI * note.frequency * 2 * local));
  }
  const fadeOut = Math.min(1, (durationSec - t) / 0.03);
  const value = Math.max(-1, Math.min(1, sample * amplitude * fadeOut));
  buffer.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}

const outPath = path.join(__dirname, '..', 'assets', 'sounds', 'task-complete.wav');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log('Wrote', outPath, buffer.length, 'bytes');
