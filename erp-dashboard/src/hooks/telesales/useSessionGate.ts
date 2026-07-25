import { useCurrentSession } from './useTelesalesSession';

/**
 * Gate for agent-facing operations (qualification, orders, devis, returns) —
 * the poste télévendeur concept assumes an active session; a paused/absent
 * session means the agent isn't "on the phone" and shouldn't be able to
 * qualify calls, create orders, send devis, etc. Read-only browsing
 * (planning list, catalogue lookup) stays unrestricted.
 */
export const useSessionGate = () => {
    const { session, loading } = useCurrentSession();
    const sessionActive = session?.status === 'active';
    return { session, sessionActive, loading };
};
