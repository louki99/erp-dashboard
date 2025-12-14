import apiClient from './client';

export interface Branch {
    code: string;
    name: string;
}

export interface Rider {
    id: number;
    name: string;
    phone: string;
    email: string;
    branch_code: string;
    branch: Branch;
    is_active: boolean;
}

export interface RidersResponse {
    success: boolean;
    message: string;
    data: {
        riders: {
            current_page: number;
            data: Rider[];
            first_page_url: string;
            from: number;
            last_page: number;
            last_page_url: string;
            links: Array<{
                url: string | null;
                label: string;
                active: boolean;
            }>;
            next_page_url: string | null;
            path: string;
            per_page: number;
            prev_page_url: string | null;
            to: number;
            total: number;
        };
    };
}

const RIDERS_BASE = '/api/backend/riders';

export const ridersApi = {
    getSimple: async (): Promise<RidersResponse> => {
        const response = await apiClient.get<RidersResponse>(`${RIDERS_BASE}/simple`);
        return response.data;
    },
};

export default ridersApi;
