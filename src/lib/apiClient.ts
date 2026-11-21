/**
 * apiClient.ts — single import point for all builders.
 *
 * Builders MUST import exclusively from "@/lib/apiClient", never directly
 * from "./api" or "./api.mock".
 *
 * At build / dev time, Vite resolves this module to:
 *   - src/lib/api.mock.ts  when VITE_USE_MOCK_API=true
 *   - src/lib/api.ts       otherwise (default / production)
 *
 * The alias is configured in vite.config.ts. This file acts as the
 * production fallback (alias is only applied when the env flag is set).
 */
export * from './api';
