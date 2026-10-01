/**
 * Application Feature Flags
 * Controls feature availability between local development and production.
 *
 * In local development, NEXT_PUBLIC_ENABLE_INSTANT_MILEGA=true in .env.local allows active engineering.
 * In production (live site), it defaults to false so InstantMilega is completely hidden & protected.
 */
export const FEATURES = {
    INSTANT_MILEGA: process.env.NEXT_PUBLIC_ENABLE_INSTANT_MILEGA === 'true',
} as const;
