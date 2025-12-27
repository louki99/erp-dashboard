import apiClient from './client';

const BASE_URL = '/api/backend/partner-balances';

export interface PartnerBalance {
    id: number;
    partner_code: string;
    // Partner name might be joined or not available directly, depending on backend. 
    // The previous mock had it, but the controller doesn't show a join.
    // We might need to fetch partner details separately or assume backend handles it.
    // For now, let's assume the backend serializer might include it or we just show code.
    // Based on user request, grid needs partner name.
    // If backend only returns partner_code, we might need a separate lookup or adjust.
    // Let's assume the API response structure roughly matches what we need.
    partner?: {
        name: string;
    };
    balance_type: 'POINTS' | 'BUDGET' | 'WALLET';
    balance: number;
    updated_at: string;
}

export interface PartnerBalanceListResponse {
    success: boolean;
    data: {
        data: PartnerBalance[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
    };
}

export interface AdjustBalanceRequest {
    partner_code: string;
    balance_type: string;
    balance: number; // The amount to add/subtract/set
    operation: 'add' | 'subtract' | 'set';
    reason?: string; // Not in backend controller yet, but good for tracking if supported later
}

export const partnerBalancesApi = {
    getBalances: async (params?: {
        page?: number;
        partner_code?: string;
        balance_type?: string;
    }) => {
        const response = await apiClient.get<PartnerBalanceListResponse>(BASE_URL, { params });
        return response.data;
    },

    getBalance: async (id: number) => {
        const response = await apiClient.get<{ success: boolean; data: PartnerBalance }>(`${BASE_URL}/${id}`);
        return response.data;
    },

    adjustBalance: async (data: AdjustBalanceRequest) => {
        const response = await apiClient.post<{ success: boolean; message: string; data: PartnerBalance }>(BASE_URL, data);
        return response.data;
    },

    deleteBalance: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_URL}/${id}`);
        return response.data;
    }
};
