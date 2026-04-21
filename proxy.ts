import { createProxySupabaseClient } from '@simplycms/core/supabase/proxy';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // Перевірка змінних середовища
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing Supabase environment variables in proxy');
    return NextResponse.next({ request });
  }

  try {
    const { supabase, response: supabaseResponse } = await createProxySupabaseClient(request);

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // Логування помилок автентифікації
    if (userError) {
      console.error('Auth error in proxy:', userError.message);
    }

    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/admin')) {
      if (!user) return NextResponse.redirect(new URL('/auth', request.url));

      const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) {
        console.error('Role check error:', roleError.message);
      }

      if (!role) return NextResponse.redirect(new URL('/', request.url));
    }

    if (pathname.startsWith('/profile')) {
      if (!user) return NextResponse.redirect(new URL('/auth', request.url));
    }

    if (pathname === '/auth' && user) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return supabaseResponse;
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ['/admin/:path*', '/profile/:path*', '/auth'],
};
