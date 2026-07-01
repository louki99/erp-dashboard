import { useState, useEffect, useCallback } from 'react';
import * as partnerApi from '../../services/api/partnerApi';
import type {
    Partner,
    PartnerFilters,
    PartnerShowResponse,
    PartnerCreateFormResponse,
    PartnerStatisticsResponse,
    PaginatedPartners,
    CreatePartnerRequest,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    CreditHistoryResponse,
    CreditExposureResponse,
    CreditEvent,
    CreditEvaluateResponse,
    PartnerBalance,
    UpsertBalanceRequest,
    PartnerPaymentTermsResponse,
    PartnerMasterData,
    PaymentMethodRecord,
    PaymentOverride,
    CreatePaymentOverrideRequest,
} from '../../types/partner.types';

// ─── Generic mutation helper ────────────────────────────────────────────────

const useMutation = <T, R>(mutationFn: (args: T) => Promise<R>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (args: T): Promise<R> => {
        setLoading(true);
        setError(null);
        try {
            const result = await mutationFn(args);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
};

// ─── List Hook ──────────────────────────────────────────────────────────────

export const usePartnersList = (filters: PartnerFilters) => {
    const [data, setData] = useState<PaginatedPartners | null>(null);
    const [priceLists, setPriceLists] = useState<{ id: number; code: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await partnerApi.getPartners(filters);
            setData(result.partners);
            if (result.priceLists?.length) setPriceLists(result.priceLists);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des partenaires');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.per_page, filters.q, filters.status, filters.partner_type, filters.channel, filters.price_list_id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, priceLists, loading, error, refetch: fetch };
};

// ─── Detail Hook ────────────────────────────────────────────────────────────

export const usePartnerDetail = (id: number | null) => {
    const [data, setData] = useState<PartnerShowResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!id) { setData(null); return; }
        setLoading(true);
        setError(null);
        try {
            const result = await partnerApi.getPartner(id);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du partenaire');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Statistics Hook ────────────────────────────────────────────────────────

export const usePartnerStatistics = () => {
    const [data, setData] = useState<PartnerStatisticsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const result = await partnerApi.getStatistics();
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
};

// ─── Partner Form Master Data Hook ──────────────────────────────────────────

export const usePartnerFormMasterData = () => {
    const [data, setData] = useState<PartnerMasterData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [masterData, countries] = await Promise.all([
                partnerApi.getPartnerFormMasterData(),
                partnerApi.getCountries(),
            ]);
            setData({ ...masterData, countries });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de chargement des données');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, fetch };
};

// ─── Form Metadata Hook (create + edit) ─────────────────────────────────────

export const useCreateFormMeta = () => {
    const [data, setData] = useState<PartnerCreateFormResponse | null>(null);
    const [loading, setLoading] = useState(false);

    /** Fetch form meta for creating a new partner (GET /partners/create) */
    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const result = await partnerApi.getCreateFormMeta();
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    /** Fetch form meta for editing a partner (GET /partners/{id}/edit) */
    const fetchForEdit = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const result = await partnerApi.getEditFormMeta(id);
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, fetch, fetchForEdit };
};

// ─── Credit History Hook ────────────────────────────────────────────────────

export const useCreditHistory = (partnerId: number | null) => {
    const [data, setData] = useState<CreditHistoryResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!partnerId) { setData(null); return; }
        setLoading(true);
        try {
            const result = await partnerApi.getCreditHistory(partnerId);
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [partnerId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
};

// ─── Payment Terms Hook ─────────────────────────────────────────────────────

export const usePaymentTerms = (partnerId: number | null) => {
    const [data, setData] = useState<PartnerPaymentTermsResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!partnerId) { setData(null); return; }
        setLoading(true);
        try {
            const result = await partnerApi.getPaymentTerms(partnerId);
            setData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [partnerId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
};

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

export const useCreatePartner = () => useMutation(partnerApi.createPartner);

export const useUpdatePartner = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: Partial<CreatePartnerRequest> }, any>(
        async ({ id, data }) => partnerApi.updatePartner(id, data)
    );
    return { updatePartner: execute, loading, error };
};

export const useDeletePartner = () => useMutation((id: number) => partnerApi.deletePartner(id));

export const useToggleStatus = () => useMutation((id: number) => partnerApi.toggleStatus(id));

export const useUpdateStatus = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdateStatusRequest }, any>(
        async ({ id, data }) => partnerApi.updateStatus(id, data)
    );
    return { updateStatus: execute, loading, error };
};

export const useBlockPartner = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: BlockPartnerRequest }, any>(
        async ({ id, data }) => partnerApi.blockPartner(id, data)
    );
    return { blockPartner: execute, loading, error };
};

export const useUnblockPartner = () => useMutation((id: number) => partnerApi.unblockPartner(id));

export const useUpdateCredit = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdateCreditRequest }, any>(
        async ({ id, data }) => partnerApi.updateCredit(id, data)
    );
    return { updateCredit: execute, loading, error };
};

export const useRecalcCredit = () => useMutation((id: number) => partnerApi.recalcCredit(id));

export const useAttachPaymentTerm = () => {
    const { loading, error, execute } = useMutation<{ partnerId: number; data: { payment_term_id: number; is_default?: boolean } }, any>(
        async ({ partnerId, data }) => partnerApi.attachPaymentTerm(partnerId, data)
    );
    return { attachPaymentTerm: execute, loading, error };
};

export const useDetachPaymentTerm = () => {
    const { loading, error, execute } = useMutation<{ partnerId: number; termId: number }, any>(
        async ({ partnerId, termId }) => partnerApi.detachPaymentTerm(partnerId, termId)
    );
    return { detachPaymentTerm: execute, loading, error };
};

export const useSetDefaultPaymentTerm = () => {
    const { loading, error, execute } = useMutation<{ partnerId: number; termId: number }, any>(
        async ({ partnerId, termId }) => partnerApi.setDefaultPaymentTerm(partnerId, termId)
    );
    return { setDefaultPaymentTerm: execute, loading, error };
};

export const useGenerateCode = () => useMutation((docType: string) => partnerApi.generateCode(docType));

export const useBulkUpdateStatus = () => useMutation(partnerApi.bulkUpdateStatus);
export const useBulkDelete = () => useMutation(partnerApi.bulkDelete);

// ─── Credit Control V2 ──────────────────────────────────────────────────────

export const useCreditExposure = (partnerId: number | null) => {
    const [data, setData] = useState<CreditExposureResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!partnerId) { setData(null); return; }
        setLoading(true);
        try {
            setData(await partnerApi.getCreditExposure(partnerId));
        } catch { setData(null); }
        finally { setLoading(false); }
    }, [partnerId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
};

export const useCreditEvents = (partnerId: number | null) => {
    const [data, setData] = useState<CreditEvent[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!partnerId) { setData([]); return; }
        setLoading(true);
        try {
            setData(await partnerApi.getCreditEvents(partnerId));
        } catch { setData([]); }
        finally { setLoading(false); }
    }, [partnerId]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
};

export const useRecalcCreditExposure = () => useMutation((id: number) => partnerApi.recalcCreditExposure(id));

// ─── Itineraries ────────────────────────────────────────────────────────────

export const useAvailableItineraries = () => {
    const [data, setData] = useState<{ id: number; code: string; name: string; branch_code: string }[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            setData(await partnerApi.getItineraries());
        } catch { setData([]); }
        finally { setLoading(false); }
    }, []);

    return { data, loading, fetch };
};

export const useAssignItinerary = () => {
    const { loading, error, execute } = useMutation<{ itineraryId: number; data: { partner_code: string; rank?: number; visit_frequency_days?: number; start_time?: string; end_time?: string; is_stop_point?: boolean; notes?: string } }, any>(
        async ({ itineraryId, data }) => partnerApi.assignItinerary(itineraryId, data)
    );
    return { assignItinerary: execute, loading, error };
};

export const useRemoveFromItinerary = () => {
    const { loading, error, execute } = useMutation<{ itineraryId: number; itineraryPartnerId: number }, any>(
        async ({ itineraryId, itineraryPartnerId }) => partnerApi.removeFromItinerary(itineraryId, itineraryPartnerId)
    );
    return { removeFromItinerary: execute, loading, error };
};

// ─── Partner Balances (§11) ──────────────────────────────────────────────────

export const usePartnerBalances = (partnerCode: string | null) => {
    const [data, setData] = useState<PartnerBalance[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        if (!partnerCode) { setData([]); return; }
        setLoading(true);
        try {
            setData(await partnerApi.getPartnerBalances(partnerCode));
        } catch { setData([]); }
        finally { setLoading(false); }
    }, [partnerCode]);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
};

export const useUpsertBalance = () => {
    const { loading, error, execute } = useMutation<UpsertBalanceRequest, PartnerBalance>(
        (data) => partnerApi.upsertPartnerBalance(data)
    );
    return { upsertBalance: execute, loading, error };
};

export const useDeleteBalance = () => useMutation((id: number) => partnerApi.deletePartnerBalance(id));

// ─── Credit evaluate dry-run (§6.5) ──────────────────────────────────────────

export const useEvaluateCreditOrder = () => {
    const [data, setData] = useState<CreditEvaluateResponse | null>(null);
    const [loading, setLoading] = useState(false);

    const evaluate = async (partnerId: number, amount: number) => {
        setLoading(true);
        setData(null);
        try {
            const result = await partnerApi.evaluateCreditOrder(partnerId, amount);
            setData(result);
            return result;
        } finally {
            setLoading(false);
        }
    };

    return { data, loading, evaluate, reset: () => setData(null) };
};

// ─── Nearby partners (§13.1) ─────────────────────────────────────────────────

export const useNearbyPartners = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const findNearby = async (lat: number | string, lng: number | string, radiusKm = 2) => {
        setLoading(true);
        try {
            const result = await partnerApi.getNearbyPartners(lat, lng, radiusKm);
            setData(result);
        } catch { setData([]); }
        finally { setLoading(false); }
    };

    return { data, loading, findNearby, reset: () => setData([]) };
};

// ─── Image upload (§13.2) ────────────────────────────────────────────────────

export const useUploadPartnerImage = () => useMutation<{ id: number; file: File }, { success: boolean; url?: string }>(
    ({ id, file }) => partnerApi.uploadPartnerImage(id, file)
);

// ─── Payment Methods (§7) ────────────────────────────────────────────────────

export const usePaymentMethods = () => {
    const [data, setData] = useState<PaymentMethodRecord[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            setData(await partnerApi.getPaymentMethods());
        } catch { setData([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, refetch: fetch };
};

// ─── Payment Overrides (§9) ──────────────────────────────────────────────────

export const usePendingOverrides = () => {
    const [data, setData] = useState<PaymentOverride[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            setData(await partnerApi.getPendingOverrides());
        } catch { setData([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);
    return { data, loading, refetch: fetch };
};

export const useCreatePaymentOverride = () => {
    const { loading, error, execute } = useMutation<CreatePaymentOverrideRequest, { success: boolean; override: PaymentOverride }>(
        (data) => partnerApi.createPaymentOverride(data)
    );
    return { createOverride: execute, loading, error };
};

export const useApproveOverride = () => {
    const { loading, error, execute } = useMutation<{ id: number; comment?: string }, { success: boolean }>(
        ({ id, comment }) => partnerApi.approveOverride(id, comment)
    );
    return { approveOverride: execute, loading, error };
};

export const useRejectOverride = () => {
    const { loading, error, execute } = useMutation<{ id: number; reason: string }, { success: boolean }>(
        ({ id, reason }) => partnerApi.rejectOverride(id, reason)
    );
    return { rejectOverride: execute, loading, error };
};
