import { describe, it, expect } from 'vitest';
import { dataUrlToBlob, dataUrlToFile } from './photo.js';

const DATA_URL = 'data:image/webp;base64,' + Buffer.from('RIFFxxxxWEBP').toString('base64');

describe('dataUrlToBlob', () => {
  it('decodes the bytes and keeps the mime type', async () => {
    const blob = dataUrlToBlob(DATA_URL);
    expect(blob.type).toBe('image/webp');
    expect(Buffer.from(await blob.arrayBuffer()).toString()).toBe('RIFFxxxxWEBP');
  });
});

describe('dataUrlToFile', () => {
  it('wraps the blob in a named File', () => {
    const file = dataUrlToFile(DATA_URL, 'photo.webp');
    expect(file.name).toBe('photo.webp');
    expect(file.type).toBe('image/webp');
    expect(file.size).toBe(12);
  });
});
