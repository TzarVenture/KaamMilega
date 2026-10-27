/**
 * Application Feature Flags
 * Controls feature availability between local development and production.
 *
 * In local development, NEXT_PUBLIC_ENABLE_INSTANT_MILEGA=true in .env.local allows active engineering.
 * In production (live site), it defaults to false so InstantMilega is completely hidden & protected.
 */
export const FEATURES = {
    INSTANT_MILEGA: process.env.NEXT_PUBLIC_ENABLE_INSTANT_MILEGA === 'true',
    // Dark theme (toggle + theme script). Defaults: on for `next dev`, off for production builds.
    // Override with NEXT_PUBLIC_ENABLE_DARK_MODE=true|false; set it to true in production to launch.
    DARK_MODE: process.env.NEXT_PUBLIC_ENABLE_DARK_MODE
        ? process.env.NEXT_PUBLIC_ENABLE_DARK_MODE === 'true'
        : process.env.NODE_ENV !== 'production',
} as const;
