/**
 * Мінімальний читач tar.gz — без залежностей і без системного `tar`.
 *
 * Формат USTAR: заголовок 512 байт, за ним вміст, вирівняний до 512.
 * Довгі шляхи GNU (`L`-запис, тип 'L') підтримані, бо npm-tarball-и
 * інколи їх містять для глибоко вкладених файлів.
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const BLOCK = 512;

const str = (buf, off, len) => {
  const raw = buf.subarray(off, off + len);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
};

/**
 * Розібрати `.tgz` у мапу «шлях усередині архіву → вміст».
 * @param {string} tgzPath
 * @returns {Map<string, Buffer>}
 */
export function readTarball(tgzPath) {
  const tar = gunzipSync(readFileSync(tgzPath));
  /** @type {Map<string, Buffer>} */
  const entries = new Map();
  let offset = 0;
  /** @type {string | null} */
  let longName = null;

  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break; // кінець архіву

    const name = longName ?? str(header, 0, 100);
    const prefix = str(header, 345, 155);
    const size = parseInt(str(header, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156]);
    const dataStart = offset + BLOCK;
    const data = tar.subarray(dataStart, dataStart + size);

    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0+$/, '');
    } else {
      longName = null;
      if (type === '0' || type === '\0') {
        entries.set(prefix ? `${prefix}/${name}` : name, Buffer.from(data));
      }
    }

    offset = dataStart + Math.ceil(size / BLOCK) * BLOCK;
  }

  return entries;
}
