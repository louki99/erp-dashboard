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
    ProductPackagingListResponse,
    CreatePackagingRequest,
    UpdatePackagingRequest,
    PackagingFormMetadata,
    ProductTranslationsResponse,
    ProductTranslation,
    ProductLogisticsResponse,
    ProductLogisticsProfile,
    ProductRetailPriceResponse,
    ProductRetailPrice,
    ProductSuppliersResponse,
    CreateProductSupplierRequest,
    UpdateProductSupplierRequest,
    ProductFlags,
    ProductFlagsResponse,
    ProductMarketing,
    ProductMarketingResponse,
    ProductSalesGroupsResponse,
    ProductPagesResponse,
    Brand,
    Category,
    Unit,
    VatTax,
    Supplier,
    ProductSalesGroup,
    ProductPage,
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

    getPackagings: async (productId: number): Promise<ProductPackagingListResponse> => {
        const response = await apiClient.get<ProductPackagingListResponse>(`${PRODUCTS_BASE}/${productId}/packagings`);
        return response.data;
    },

    getTranslations: async (productId: number): Promise<any> => {
        const response = await apiClient.get(`${PRODUCTS_BASE}/${productId}/translations`);
        // Unwrap both { success, data: { translations } } and plain { translations }
        return response.data?.data ?? response.data;
    },

    createTranslation: async (productId: number, payload: ProductTranslation): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/translations`, payload);
        return response.data;
    },

    updateTranslation: async (productId: number, lang: string, payload: ProductTranslation): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/translations/${lang}`, payload);
        return response.data;
    },

    deleteTranslation: async (productId: number, lang: string): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/translations/${lang}`);
        return response.data;
    },

    getLogistics: async (productId: number): Promise<ProductLogisticsResponse> => {
        const response = await apiClient.get<ProductLogisticsResponse>(`${PRODUCTS_BASE}/${productId}/logistics`);
        return response.data;
    },

    updateLogistics: async (productId: number, payload: ProductLogisticsProfile): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/logistics`, payload);
        return response.data;
    },

    getPackagingFormMetadata: async (): Promise<PackagingFormMetadata> => {
        const response = await apiClient.get<PackagingFormMetadata>('/api/backend/product-packagings/create');
        return response.data;
    },

    createPackaging: async (payload: CreatePackagingRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`/api/backend/product-packagings`, payload);
        return response.data;
    },

    updatePackaging: async (id: number, payload: UpdatePackagingRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/product-packagings/${id}`, payload);
        return response.data;
    },

    deletePackaging: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/product-packagings/${id}`);
        return response.data;
    },

    getSuppliers: async (productId: number): Promise<ProductSuppliersResponse> => {
        const response = await apiClient.get<ProductSuppliersResponse>(`${PRODUCTS_BASE}/${productId}/suppliers`);
        return response.data;
    },

    createSupplier: async (productId: number, payload: CreateProductSupplierRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/suppliers`, payload);
        return response.data;
    },

    updateSupplier: async (productId: number, supplierId: number, payload: UpdateProductSupplierRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/suppliers/${supplierId}`, payload);
        return response.data;
    },

    deleteSupplier: async (productId: number, supplierId: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/suppliers/${supplierId}`);
        return response.data;
    },

    getRetailPrice: async (productId: number): Promise<ProductRetailPriceResponse> => {
        const response = await apiClient.get<ProductRetailPriceResponse>(`${PRODUCTS_BASE}/${productId}/retail-price`);
        return response.data;
    },

    updateRetailPrice: async (productId: number, payload: ProductRetailPrice): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/retail-price`, payload);
        return response.data;
    },

    getFlags: async (productId: number): Promise<ProductFlagsResponse> => {
        const response = await apiClient.get<ProductFlagsResponse>(`${PRODUCTS_BASE}/${productId}/flags`);
        return response.data;
    },

    updateFlags: async (productId: number, payload: Partial<ProductFlags>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/flags`, payload);
        return response.data;
    },

    getMarketing: async (productId: number): Promise<ProductMarketingResponse> => {
        const response = await apiClient.get<ProductMarketingResponse>(`${PRODUCTS_BASE}/${productId}/marketing`);
        return response.data;
    },

    updateMarketing: async (productId: number, payload: Partial<ProductMarketing>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/marketing`, payload);
        return response.data;
    },

    setMainImage: async (productId: number, file: File): Promise<ApiSuccessResponse> => {
        const formData = new FormData();
        formData.append('thumbnail', file);
        const response = await apiClient.post<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/main-image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getProductSalesGroups: async (params?: { active_only?: boolean; search?: string; paginate?: boolean }): Promise<ProductSalesGroupsResponse> => {
        const response = await apiClient.get<ProductSalesGroupsResponse>('/api/backend/product-sales-groups', { params });
        return response.data;
    },

    getProductPages: async (params?: { tree?: boolean }): Promise<ProductPagesResponse> => {
        const response = await apiClient.get<ProductPagesResponse>('/api/backend/product-pages', { params });
        return response.data;
    },

    // GET /categories — manage-products. Falls back to create bundle if primary is empty or errors.
    getCategoriesList: async (): Promise<any> => {
        const tryExtract = (body: any): any[] => {
            if (Array.isArray(body)) return body;
            if (Array.isArray(body?.data)) return body.data;
            if (Array.isArray(body?.data?.data)) return body.data.data;
            if (Array.isArray(body?.data?.categories)) return body.data.categories;
            if (Array.isArray(body?.categories)) return body.categories;
            return [];
        };
        try {
            const res = await apiClient.get('/api/backend/categories');
            const list = tryExtract(res.data);
            if (list.length > 0) return res.data;
            // empty → fall through to create-bundle fallback
        } catch { /* fall through */ }
        try {
            const fallback = await apiClient.get('/api/backend/products/create');
            const body = fallback.data?.data ?? fallback.data;
            const cats = body?.categories ?? body?.data?.categories ?? [];
            return { data: cats };
        } catch {
            return { data: [] };
        }
    },

    // GET /subcategories — manage-products.
    getSubcategoriesList: async (): Promise<any> => {
        try {
            const res = await apiClient.get('/api/backend/subcategories');
            return res.data;
        } catch {
            return { data: [] };
        }
    },

    // ─── Per-product classification facet endpoints (§7.1–§7.8) ──────────────

    // GET /products/{id}/categories → { product_id, categories: [...] }
    getProductCategories: async (productId: number): Promise<{ product_id: number; categories: any[] }> => {
        const response = await apiClient.get<{ data: { product_id: number; categories: any[] } }>(`${PRODUCTS_BASE}/${productId}/categories`);
        return response.data.data ?? (response.data as any);
    },

    updateProductCategories: async (productId: number, categoryIds: number[]): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/categories`, { category_ids: categoryIds });
        return response.data;
    },

    getProductSubcategories: async (productId: number): Promise<{ product_id: number; subcategories: any[] }> => {
        const response = await apiClient.get<{ data: { product_id: number; subcategories: any[] } }>(`${PRODUCTS_BASE}/${productId}/subcategories`);
        return response.data.data ?? (response.data as any);
    },

    updateProductSubcategories: async (productId: number, subcategoryIds: number[]): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/subcategories`, { subcategory_ids: subcategoryIds });
        return response.data;
    },

    getProductVatTaxesFacet: async (productId: number): Promise<{ product_id: number; vat_taxes: any[] }> => {
        const response = await apiClient.get<{ data: { product_id: number; vat_taxes: any[] } }>(`${PRODUCTS_BASE}/${productId}/vat-taxes`);
        return response.data.data ?? (response.data as any);
    },

    updateProductVatTaxesFacet: async (productId: number, vatTaxIds: number[]): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/vat-taxes`, { vat_tax_ids: vatTaxIds });
        return response.data;
    },

    getProductPageFacet: async (productId: number): Promise<{ product_id: number; product_page: any | null }> => {
        const response = await apiClient.get<{ data: { product_id: number; product_page: any | null } }>(`${PRODUCTS_BASE}/${productId}/page`);
        return response.data.data ?? (response.data as any);
    },

    updateProductPageFacet: async (productId: number, code: string | null): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/page`, { code });
        return response.data;
    },

    getProductSalesGroupFacet: async (productId: number): Promise<{ product_id: number; product_sales_group: any | null }> => {
        const response = await apiClient.get<{ data: { product_id: number; product_sales_group: any | null } }>(`${PRODUCTS_BASE}/${productId}/sales-group`);
        return response.data.data ?? (response.data as any);
    },

    updateProductSalesGroupFacet: async (productId: number, code: string | null): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/sales-group`, { code });
        return response.data;
    },

    updateProductBrand: async (productId: number, brandId: number | null): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/brand`, { brand_id: brandId });
        return response.data;
    },

    updateProductUnit: async (productId: number, unitId: number | null): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`${PRODUCTS_BASE}/${productId}/unit`, { unit_id: unitId });
        return response.data;
    },

    // ─── Master data hub ────────────────────────────────────────────────────────

    getBrands: async (params?: { search?: string; active_only?: boolean; paginate?: boolean; per_page?: number }): Promise<{ success: boolean; data?: Brand[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: Brand[] }>('/api/backend/master-data/brands', { params });
        return response.data;
    },

    createBrand: async (payload: Partial<Brand>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/brands', payload);
        return response.data;
    },

    updateBrand: async (id: number, payload: Partial<Brand>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/brands/${id}`, payload);
        return response.data;
    },

    deleteBrand: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/brands/${id}`);
        return response.data;
    },

    toggleBrand: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/brands/${id}/toggle`);
        return response.data;
    },

    getCategories: async (params?: { search?: string; active_only?: boolean; paginate?: boolean }): Promise<{ success: boolean; data?: Category[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: Category[] }>('/api/backend/master-data/categories', { params });
        return response.data;
    },

    createCategory: async (payload: Partial<Category>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/categories', payload);
        return response.data;
    },

    updateCategory: async (id: number, payload: Partial<Category>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/categories/${id}`, payload);
        return response.data;
    },

    deleteCategory: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/categories/${id}`);
        return response.data;
    },

    toggleCategory: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/categories/${id}/toggle`);
        return response.data;
    },

    uploadCategoryImage: async (id: number, file: File): Promise<{ success: boolean; data?: { id: number; file_name: string; thumbnail: string } }> => {
        const form = new FormData();
        form.append('image', file);
        const response = await apiClient.post(`/api/backend/master-data/categories/${id}/image`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    deleteCategoryImage: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/categories/${id}/image`);
        return response.data;
    },

    getSubcategories: async (params?: { search?: string; active_only?: boolean; paginate?: boolean }): Promise<{ success: boolean; data?: Category[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: Category[] }>('/api/backend/master-data/sub-categories', { params });
        return response.data;
    },

    createSubcategory: async (payload: Partial<Category>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/sub-categories', payload);
        return response.data;
    },

    updateSubcategory: async (id: number, payload: Partial<Category>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/sub-categories/${id}`, payload);
        return response.data;
    },

    deleteSubcategory: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/sub-categories/${id}`);
        return response.data;
    },

    toggleSubcategory: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/sub-categories/${id}/toggle`);
        return response.data;
    },

    getUnits: async (params?: { search?: string; active_only?: boolean; paginate?: boolean }): Promise<{ success: boolean; data?: Unit[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: Unit[] }>('/api/backend/master-data/units', { params });
        return response.data;
    },

    createUnit: async (payload: Partial<Unit>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/units', payload);
        return response.data;
    },

    updateUnit: async (id: number, payload: Partial<Unit>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/units/${id}`, payload);
        return response.data;
    },

    deleteUnit: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/units/${id}`);
        return response.data;
    },

    toggleUnit: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/units/${id}/toggle`);
        return response.data;
    },

    getVatTaxes: async (params?: { search?: string; active_only?: boolean; paginate?: boolean; per_page?: number }): Promise<{ success: boolean; data?: VatTax[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: VatTax[] }>('/api/backend/master-data/vat-taxes', { params });
        return response.data;
    },

    createVatTax: async (payload: Partial<VatTax>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/vat-taxes', payload);
        return response.data;
    },

    updateVatTax: async (id: number, payload: Partial<VatTax>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/vat-taxes/${id}`, payload);
        return response.data;
    },

    deleteVatTax: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/vat-taxes/${id}`);
        return response.data;
    },

    toggleVatTax: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/vat-taxes/${id}/toggle`);
        return response.data;
    },

    getSuppliersList: async (params?: { search?: string; active_only?: boolean; paginate?: boolean; per_page?: number }): Promise<{ success: boolean; data: Supplier[] }> => {
        const response = await apiClient.get<{ success: boolean; data?: Supplier[] | { data: Supplier[] } }>('/api/backend/master-data/suppliers', { params });
        const raw: any = response.data;
        let list: Supplier[] = [];
        if (Array.isArray(raw.data)) {
            list = raw.data;
        } else if (Array.isArray(raw.data?.data)) {
            list = raw.data.data;
        }
        return { success: raw.success ?? true, data: list };
    },

    createSupplierMaster: async (payload: Partial<Supplier>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/suppliers', payload);
        return response.data;
    },

    updateSupplierMaster: async (id: number, payload: Partial<Supplier>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/suppliers/${id}`, payload);
        return response.data;
    },

    deleteSupplierMaster: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/suppliers/${id}`);
        return response.data;
    },

    toggleSupplierMaster: async (id: number): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/suppliers/${id}/toggle`);
        return response.data;
    },

    createProductSalesGroup: async (payload: Partial<ProductSalesGroup>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/product-sales-groups', payload);
        return response.data;
    },

    updateProductSalesGroup: async (code: string, payload: Partial<ProductSalesGroup>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/product-sales-groups/${code}`, payload);
        return response.data;
    },

    deleteProductSalesGroup: async (code: string): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/product-sales-groups/${code}`);
        return response.data;
    },

    toggleProductSalesGroup: async (code: string): Promise<ApiSuccessResponse> => {
        const response = await apiClient.patch<ApiSuccessResponse>(`/api/backend/master-data/product-sales-groups/${code}/toggle`);
        return response.data;
    },

    createProductPage: async (payload: Partial<ProductPage>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>('/api/backend/master-data/product-pages', payload);
        return response.data;
    },

    updateProductPage: async (code: string, payload: Partial<ProductPage>): Promise<ApiSuccessResponse> => {
        const response = await apiClient.put<ApiSuccessResponse>(`/api/backend/master-data/product-pages/${code}`, payload);
        return response.data;
    },

    deleteProductPage: async (code: string): Promise<ApiSuccessResponse> => {
        const response = await apiClient.delete<ApiSuccessResponse>(`/api/backend/master-data/product-pages/${code}`);
        return response.data;
    },

    uploadProductPageImages: async (code: string, files: { logo?: File; photo?: File }): Promise<{ success: boolean; message?: string; product_page?: ProductPage }> => {
        const form = new FormData();
        form.append('_method', 'PUT');
        if (files.logo) form.append('logo', files.logo);
        if (files.photo) form.append('photo', files.photo);
        const response = await apiClient.post(`/api/backend/product-pages/${code}`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },
};
