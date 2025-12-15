import apiClient from './client';
import type {
    ProductsListResponse,
    ProductDetailResponse,
    ProductFormMetadata,
    CreateProductRequest,
    ApiSuccessResponse,
    ProductFilters,
    BulkUpdateRequest,
    ProductStatistics,
    StockSummaryResponse,
} from '@/types/product.types';

const PRODUCTS_BASE = '/api/backend/products';

export const productsApi = {
    getList: async (filters?: ProductFilters): Promise<ProductsListResponse> => {
        const response = await apiClient.get<ProductsListResponse>(PRODUCTS_BASE, {
            params: filters,
        });
        return response.data;
    },

    getFormMetadata: async (): Promise<ProductFormMetadata> => {
        const response = await apiClient.get<ProductFormMetadata>(`${PRODUCTS_BASE}/create`);
        return response.data;
    },

    create: async (data: CreateProductRequest): Promise<ApiSuccessResponse> => {
        const formData = new FormData();
        
        Object.keys(data).forEach((key) => {
            const value = data[key];
            
            if (value === undefined || value === null) return;
            
            if (key === 'thumbnail' && value instanceof File) {
                formData.append('thumbnail', value);
            } else if (key === 'additionThumbnail' && Array.isArray(value)) {
                value.forEach((file) => {
                    if (file instanceof File) {
                        formData.append('additionThumbnail[]', file);
                    }
                });
            } else if (Array.isArray(value)) {
                value.forEach((item) => {
                    formData.append(`${key}[]`, String(item));
                });
            } else if (typeof value === 'object') {
                formData.append(key, JSON.stringify(value));
            } else {
                formData.append(key, String(value));
            }
        });

        const response = await apiClient.post<ApiSuccessResponse>(PRODUCTS_BASE, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getDetail: async (id: number): Promise<ProductDetailResponse> => {
        const response = await apiClient.get<ProductDetailResponse>(`${PRODUCTS_BASE}/${id}`);
        return response.data;
    },

    getEdit: async (id: number): Promise<ProductFormMetadata & { product: any }> => {
        const response = await apiClient.get<ProductFormMetadata & { product: any }>(`${PRODUCTS_BASE}/${id}/edit`);
        return response.data;
    },

    update: async (id: number, data: CreateProductRequest): Promise<ApiSuccessResponse> => {
        const formData = new FormData();
        formData.append('_method', 'PUT');
        
        Object.keys(data).forEach((key) => {
            const value = data[key];
            
            if (value === undefined || value === null) return;
            
            if (key === 'thumbnail' && value instanceof File) {
                formData.append('thumbnail', value);
            } else if (key === 'additionThumbnail' && Array.isArray(value)) {
                value.forEach((file) => {
                    if (file instanceof File) {
                        formData.append('additionThumbnail[]', file);
                    }
                });
            } else if (Array.isArray(value)) {
                value.forEach((item) => {
                    formData.append(`${key}[]`, String(item));
                });
            } else if (typeof value === 'object') {
                formData.append(key, JSON.stringify(value));
            } else {
                formData.append(key, String(value));
            }
        });

        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    delete: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`${PRODUCTS_BASE}/${id}`);
        return response.data;
    },

    approve: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${id}/approve`);
        return response.data;
    },

    toggleStatus: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`${PRODUCTS_BASE}/${id}/toggle-status`);
        return response.data;
    },

    deleteThumbnail: async (productId: number, mediaId: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/thumbnails/${mediaId}`);
        return response.data;
    },

    uploadImages: async (productId: number, images: File[]): Promise<ApiSuccessResponse> => {
        const formData = new FormData();
        images.forEach((image) => {
            formData.append('images[]', image);
        });

        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/images`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getBarcode: async (id: number, qty?: number): Promise<any> => {
        const response = await apiClient.get(`${PRODUCTS_BASE}/${id}/barcode`, {
            params: { qty },
        });
        return response.data;
    },

    getStock: async (id: number): Promise<StockSummaryResponse> => {
        const response = await apiClient.get<StockSummaryResponse>(`${PRODUCTS_BASE}/${id}/stock`);
        return response.data;
    },

    bulkUpdate: async (data: BulkUpdateRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/bulk-update`, data);
        return response.data;
    },

    search: async (query: string, categoryId?: number, limit?: number): Promise<any> => {
        const response = await apiClient.get(`${PRODUCTS_BASE}/search`, {
            params: {
                q: query,
                category_id: categoryId,
                limit,
            },
        });
        return response.data;
    },

    generateAiDescription: async (name: string, shortDescription?: string): Promise<any> => {
        const response = await apiClient.post(`${PRODUCTS_BASE}/generate-ai-description`, {
            name,
            short_description: shortDescription,
        });
        return response.data;
    },

    getStatistics: async (): Promise<ProductStatistics> => {
        const response = await apiClient.get<ProductStatistics>(`${PRODUCTS_BASE}/statistics`);
        return response.data;
    },
};
