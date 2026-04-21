/**
 * @deprecated ISR revalidation — Next.js-specific механізм.
 * У TanStack Start storefront працює на свіжому SSR без cross-request cache.
 * Тема-інвалідація реалізована через invalidateThemeCache() в src/server/themes.ts.
 * Повна заміна на server handler — Phase 4/5.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@simplycms/core/supabase/server';

/**
 * Перевірка адмін-ролі через cookie-based сесію.
 * Використовується для захисту ревалідації з адмінки (без публічного секрету).
 */
async function isAdminSession(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    return !!role;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { secret, type, slug, sectionSlug, path } = await request.json();

    // Авторизація: секрет (для webhook/CI) АБО адмін-сесія (для адмінки)
    const hasValidSecret = secret && secret === process.env.REVALIDATION_SECRET;
    const hasAdminAuth = !hasValidSecret && await isAdminSession();

    if (!hasValidSecret && !hasAdminAuth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const revalidated: string[] = [];

    if (type === 'theme') {
      // Інвалідація кешу активної теми (unstable_cache tag)
      revalidateTag('active-theme', 'max');
      // Повна ревалідація layout (включає всі storefront сторінки)
      revalidatePath('/', 'layout');
      revalidated.push('/');
    } else if (type === 'product' && slug && sectionSlug) {
      revalidatePath(`/catalog/${sectionSlug}/${slug}`);
      revalidatePath(`/catalog/${sectionSlug}`);
      revalidatePath('/catalog');
      revalidated.push(`/catalog/${sectionSlug}/${slug}`, `/catalog/${sectionSlug}`, '/catalog');
    } else if (type === 'section' && slug) {
      revalidatePath(`/catalog/${slug}`);
      revalidatePath('/catalog');
      revalidated.push(`/catalog/${slug}`, '/catalog');
    } else if (type === 'banner') {
      revalidatePath('/');
      revalidated.push('/');
    } else if (path) {
      revalidatePath(path);
      revalidated.push(path);
    }

    return NextResponse.json({ revalidated: true, paths: revalidated, now: Date.now() });
  } catch {
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
