// Складання EngineContext для simplyCMS-застосунку через @simplycms/runtime.
// Це reference-приклад P9: магазин збирається з адаптерів data-supabase
// + app-специфічних LinkResolver/MediaProvider/ConfigProvider.
//
// Викликати лише в серверному контексті (createServerFn handler / middleware),
// бо createServerSupabase читає request-cookies.

import {
  createSupabaseCatalogRepository,
  createSupabaseOrderRepository,
  createSupabaseIdentityProvider,
  singleTenantScope,
} from "@simplycms/data-supabase";
import { defineConfig, type SimplyCmsRuntime } from "@simplycms/runtime";
import type {
  LinkResolver,
  MediaProvider,
  ConfigProvider,
  ImageOpts,
} from "@simplycms/objects";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase";

/** Маршрути simplyCMS-вітрини. */
export const appLinks: LinkResolver = {
  product: (p) =>
    p.sectionSlug ? `/catalog/${p.sectionSlug}/${p.slug}` : `/catalog/${p.slug}`,
  section: (s) => `/catalog/${s.slug}`,
  cart: () => "/cart",
  checkout: () => "/checkout",
  profile: (sub) => (sub ? `/profile/${sub}` : "/profile"),
  auth: () => "/auth",
  admin: (sub) => (sub ? `/admin/${sub}` : "/admin"),
};

/** Медіа через Supabase Storage. */
export function createAppMediaProvider(
  client: SupabaseClient,
  bucket = "media",
): MediaProvider {
  return {
    url(path: string, opts?: ImageOpts): string {
      if (/^https?:\/\//.test(path)) return path;
      const { data } = client.storage.from(bucket).getPublicUrl(path);
      const base = data.publicUrl;
      if (!opts) return base;
      const params = new URLSearchParams();
      if (opts.width) params.set("width", String(opts.width));
      if (opts.height) params.set("height", String(opts.height));
      if (opts.quality) params.set("quality", String(opts.quality));
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    async upload(file: File): Promise<string> {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await client.storage.from(bucket).upload(path, file);
      if (error) throw new Error(`[media.upload] ${error.message}`);
      return path;
    },
  };
}

/** Конфіг вітрини. */
export const appConfig: ConfigProvider = {
  locale: "uk-UA",
  currency: "UAH",
  siteUrl: import.meta.env.VITE_SITE_URL ?? "",
  seo: {
    defaultTitle: "SimplyCMS Store — Best Products",
    titleTemplate: "%s | SimplyCMS Store",
    defaultDescription: "SimplyCMS Store",
  },
};

/**
 * Збирає серверний рантайм магазину: один інжектований Supabase-клієнт
 * + адаптери репозиторіїв + app-провайдери. Single-tenant (без hub_id).
 */
export function createServerRuntime(cookieHeader?: string): SimplyCmsRuntime {
  const client = createServerSupabase(cookieHeader) as unknown as SupabaseClient;
  return defineConfig({
    adapters: {
      catalog: createSupabaseCatalogRepository(client, singleTenantScope),
      orders: createSupabaseOrderRepository(client, singleTenantScope),
      identity: createSupabaseIdentityProvider(client),
      scope: singleTenantScope,
      links: appLinks,
      media: createAppMediaProvider(client),
      config: appConfig,
    },
  });
}
