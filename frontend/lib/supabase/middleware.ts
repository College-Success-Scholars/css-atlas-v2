/**
 * @file middleware.ts
 * @module frontend/lib/supabase
 *
 * Supabase session refresh middleware for Next.js Edge runtime.
 * Refreshes the user's Supabase auth session on every request so that
 * Server Components always receive a valid, up-to-date JWT in cookies.
 * Called by the root frontend/proxy.ts file.
 *
 * ## What belongs here
 * - updateSession(request): the session refresh middleware function
 *
 * ## What does NOT belong here
 * - Auth guards (those go in individual pages via lib/supabase/server.ts)
 * - Business logic
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Responses that depend on who is asking must never be stored by the CDN in
 * front of the frontend (.railway/railway.ts). Redirects carry no
 * Cache-Control by default, so mark them explicitly.
 */
function uncacheable(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
import { getSupabasePublicKey } from "./public-key";

/**
 * Refreshes the Supabase auth session from request cookies and enforces login
 * for protected routes. Unauthenticated requests to non-public paths are
 * redirected to `/auth/login`. Public paths: `/`, `/auth/*`, `/traffic` (kiosk
 * check-in for anyone, signed-in or not — no role redirect on this path), and
 * static assets (`/_next`, favicon, common image/font extensions).
 *
 * Side effects: reads session cookies from the request and may write refreshed
 * session cookies onto the response.
 *
 * @param request - Incoming Next.js request (carries Supabase session cookies)
 * @returns Next.js response with refreshed session cookies, or a redirect to
 *   `/auth/login` when the session is missing on a protected path
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  // Next.js static assets must not hit auth redirects (browser would get HTML instead of CSS/JS/fonts).
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return supabaseResponse;
  }
  // Files from public/ (and next/image internal fetches) must bypass auth — otherwise the
  // optimizer receives a redirect/HTML and fails with "isn't a valid image ... received null".
  if (/\.(ico|png|jpg|jpeg|svg|gif|webp|avif|woff2?|ttf|eot)$/i.test(pathname)) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabaseKey = getSupabasePublicKey();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (
    pathname !== "/" &&
    !user &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/auth") &&
    pathname !== "/traffic" &&
    !pathname.startsWith("/traffic/")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return uncacheable(NextResponse.redirect(url));
  }

  // The email-confirm handler redirects based on a one-time token and sets session cookies.
  if (pathname.startsWith("/auth/confirm")) uncacheable(supabaseResponse);

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
