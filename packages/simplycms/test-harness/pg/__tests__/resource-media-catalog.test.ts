// К3-Е6д-1: фото каталогу — розділ, опція властивості — стирається
// заміною, прибиранням і каскадом видалення предка (розділ, властивість).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  propertyOptionsOps,
  sectionPropertiesOps,
  sectionsOps,
} from 'simplycms/admin-server/impl';
import { useCatalogMediaDb } from './fixtures/catalog-media';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('фото каталогу стираються двофазно (К3-Е6д-1)', () => {
  const d = useCatalogMediaDb('simplycms_e6d_media_catalog');
  afterEach(() => vi.restoreAllMocks());
  const gone = async (ref: string) => {
    expect(await d.mediaRows(ref)).toHaveLength(0);
    expect(d.hasFile(ref)).toBe(false);
  };

  it('секція: заміна image_url стирає старий файл', async () => {
    const id = crypto.randomUUID();
    const old = await d.upload('section', id);
    await d.f.rows(
      `insert into public.sections (id, slug, name, image_url) values ($1, $2, 'С', $3)`,
      [id, `c-${id.slice(0, 8)}`, old],
    );
    const next = await d.upload('section', id);
    await sectionsOps.update({ data: [{ id, patch: { imageUrl: next } }] });
    await gone(old);
    expect(d.hasFile(next)).toBe(true);
  });

  it('видалення секції стирає image_url опцій її властивостей', async () => {
    const sectionId = await d.section();
    const prop = await d.property(sectionId);
    const { ref } = await d.option(prop);
    expect(d.hasFile(ref!)).toBe(true);
    await sectionsOps.remove({ data: [{ id: sectionId }] });
    await gone(ref!);
  });

  it('видалення секції з фото: стирає і власне фото секції', async () => {
    const id = crypto.randomUUID();
    const own = await d.upload('section', id);
    await d.f.rows(
      `insert into public.sections (id, slug, name, image_url) values ($1, $2, 'С', $3)`,
      [id, `c-${id.slice(0, 8)}`, own],
    );
    await sectionsOps.remove({ data: [{ id }] });
    await gone(own);
  });

  it('видалення section_properties стирає фото її опцій', async () => {
    const prop = await d.property();
    const a = await d.option(prop);
    const b = await d.option(prop);
    await sectionPropertiesOps.remove({ data: [{ id: prop }] });
    await gone(a.ref!);
    await gone(b.ref!);
  });

  it('опція: заміна image_url стирає старий файл', async () => {
    const prop = await d.property();
    const { id, ref } = await d.option(prop);
    const next = await d.upload('property_option', id);
    await propertyOptionsOps.update({
      data: [{ id, patch: { imageUrl: next } }],
    });
    await gone(ref!);
    expect(d.hasFile(next)).toBe(true);
  });
});
