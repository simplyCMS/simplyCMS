import { describe, expect, it } from 'vitest';
import { inspectUpload } from '../inspect';

const file = (
  bytes: Uint8Array<ArrayBuffer>,
  name = 'a.png',
  type = 'image/png',
) => new File([bytes], name, { type });
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);

describe('inspectUpload', () => {
  it('валідний PNG → ok із байтами, MIME і розміром', async () => {
    const result = await inspectUpload(file(PNG));
    expect(result).toEqual({
      ok: true,
      bytes: PNG,
      mime: 'image/png',
      size: PNG.length,
    });
  });

  // 🔴 Два кейси, заради яких сніфер узагалі існує: обидва канали, якими
  // клієнт «повідомляє» тип, тут брешуть — а байти ні.
  it('SVG із розширенням .png і type image/png → unsupported_type', async () => {
    const svg = ascii('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(await inspectUpload(file(svg, 'photo.png', 'image/png'))).toEqual({
      ok: false,
      reason: 'unsupported_type',
    });
  });

  it('PNG-сигнатура при брехливому file.type приймається за сигнатурою', async () => {
    const result = await inspectUpload(
      file(PNG, 'x.bin', 'application/octet-stream'),
    );
    expect(result.ok && result.mime).toBe('image/png');
  });

  it('понад ліміт → too_large, і байти НЕ читаються', async () => {
    const big = file(new Uint8Array(11 * 1024 * 1024));
    expect(await inspectUpload(big)).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('ліміт — параметр: аватарна стеля жорсткіша', async () => {
    const sixMb = file(new Uint8Array(6 * 1024 * 1024));
    expect(await inspectUpload(sixMb, 5 * 1024 * 1024)).toEqual({
      ok: false,
      reason: 'too_large',
    });
  });

  it('порожній файл → unsupported_type, а не збій', async () => {
    expect(await inspectUpload(file(new Uint8Array()))).toEqual({
      ok: false,
      reason: 'unsupported_type',
    });
  });
});
