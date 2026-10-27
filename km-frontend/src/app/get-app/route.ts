import { NextResponse, type NextRequest } from 'next/server';
import { APP_LINKS } from '@/config/appLinks';
import { FEATURES } from '@/config/features';

// One link for the app (the QR code on desktop points here): sends phones to their store, and
// everyone else, or everyone before the app is published, to the InstantMilega page (home page
// while that page is switched off).
export function GET(request: NextRequest) {
    const ua = request.headers.get('user-agent') || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    const store = isIOS ? APP_LINKS.APP_STORE : isAndroid ? APP_LINKS.PLAY_STORE : '';
    return NextResponse.redirect(store || new URL(FEATURES.INSTANT_MILEGA ? '/instant-milega' : '/', request.url), 307);
}
