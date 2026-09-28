import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;

    const tokenCookie = request.cookies.get('km_auth_token')?.value;
    const roleCookie = request.cookies.get('km_user_role')?.value;

    // 1. Role-Based Routing for /instant-milega
    if (pathname === '/instant-milega') {
        // If logged-in user is a recruiter and no explicit role parameter was forced in the URL
        if (roleCookie === 'recruiter' && !searchParams.has('role')) {
            const url = request.nextUrl.clone();
            url.searchParams.set('role', 'recruiter');
            // Internal rewrite: keeps browser URL clean as /instant-milega while serving recruiter mode
            const response = NextResponse.rewrite(url);
            response.headers.set('x-user-role', 'recruiter');
            return response;
        }

        const response = NextResponse.next();
        response.headers.set('x-user-role', roleCookie || 'guest');
        return response;
    }

    // 2. Strict Role Gating for Recruiter Portal
    // Paths like /recruiter, /recruiter/dashboard, /recruiter/jobs (excluding /recruiter/login and /recruiter/register)
    if (pathname.startsWith('/recruiter') &&
        !pathname.startsWith('/recruiter/login') &&
        !pathname.startsWith('/recruiter/register') &&
        !pathname.startsWith('/recruiter/forgot-password')
    ) {
        // If cookie is explicitly set and user is NOT a recruiter, redirect away
        if (roleCookie && roleCookie !== 'recruiter') {
            const loginUrl = new URL('/recruiter/login', request.url);
            return NextResponse.redirect(loginUrl);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public images/assets
         */
        '/((?!_next/static|_next/image|favicon.ico|asset|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
