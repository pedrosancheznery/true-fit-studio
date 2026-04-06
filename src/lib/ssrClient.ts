import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { GetServerSidePropsContext } from 'next'

export const getSSRClient = (context: GetServerSidePropsContext) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => Object.keys(context.req.cookies).map((name) => ({ name, value: context.req.cookies[name] || '' })),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) => 
          context.res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options))
        ),
      },
    }
  )
}
