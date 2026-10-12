import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageUpload, validatePdfUpload } from '../src/lib/media/validate-upload.ts';

const jpeg = [0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46];
const png = [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
const webp = [82,73,70,70,20,0,0,0,87,69,66,80,86,80,56,32];
const pdf = [...Buffer.from('%PDF-1.7\n')];
const make = (bytes, type='image/jpeg', name='file.jpg') => new File([new Uint8Array(bytes)], name, { type });

test('validates real JPEG, PNG, WebP headers and sets a canonical extension', async () => {
  for (const [head,mime,ext] of [[jpeg,'image/jpeg','jpg'], [png,'image/png','png'], [webp,'image/webp','webp']]) {
    const result = await validateImageUpload(make(head,mime,'malicious.svg'));
    assert.deepEqual(result, { mimeType:mime, extension:ext });
  }
});

test('rejects MIME spoofing and disguised executables or SVG', async () => {
  assert.match((await validateImageUpload(make(png,'image/jpeg'))).error, /invalide/);
  assert.match((await validateImageUpload(make([...Buffer.from('<svg onload=alert(1)>')],'image/svg+xml'))).error, /invalide/);
  assert.match((await validateImageUpload(make([...Buffer.from('<?php die(); ?>')],'image/jpeg'))).error, /invalide/);
});

test('rejects empty and oversized image payloads', async () => {
  assert.ok((await validateImageUpload(make([]))).error);
  assert.match((await validateImageUpload(make(png,'image/png'), 4)).error, /lourde/);
});

test('validates PDF bytes and declared MIME rather than extension', async () => {
  assert.deepEqual(await validatePdfUpload(make(pdf,'application/pdf','script.bin')),{});
  assert.match((await validatePdfUpload(make(jpeg,'application/pdf','fake.pdf'))).error, /invalide/);
  assert.match((await validatePdfUpload(make(pdf,'text/plain','fake.pdf'))).error, /invalide/);
  assert.ok((await validatePdfUpload(make([],'application/pdf'))).error);
});
