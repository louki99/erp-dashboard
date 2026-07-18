import { useEffect, useState } from 'react';
import { productsApi } from '@/services/api/productsApi';
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
    ProductTranslationsResponse,
    ProductTranslation,
    ProductLogisticsResponse,
    ProductLogisticsProfile,
    ProductSuppliersResponse,
    CreateProductSupplierRequest,
    UpdateProductSupplierRequest,
    ProductRetailPriceResponse,
    ProductRetailPrice,
    ProductFlags,
    ProductFlagsResponse,
    ProductMarketing,
    ProductMarketingResponse,
    ProductSalesGroupsResponse,
    ProductPagesResponse,
} from '@/types/product.types';

export const useProductsList = (filters?: ProductFilters) => {
    const [data, setData] = useState<ProductsListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getList(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch products');
            console.error('Failed to fetch products:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [filters?.page, filters?.status, filters?.search, filters?.category, filters?.brand]);

    return { data, loading, error, refetch: fetchList };
};

export const useProductDetail = (id: number | null) => {
    const [data, setData] = useState<ProductDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = async () => {
        if (!id) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getDetail(id);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch product');
            console.error('Failed to fetch product:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    return { data, loading, error, refetch: fetchDetail };
};

export const useProductFormMetadata = () => {
    const [data, setData] = useState<ProductFormMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMetadata = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getFormMetadata();
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch form metadata');
            console.error('Failed to fetch form metadata:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
    }, []);

    return { data, loading, error, refetch: fetchMetadata };
};

export const useCreateProduct = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async (payload: CreateProductRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.create(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create product');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { create, loading, error };
};

export const useUpdateProduct = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (id: number, payload: CreateProductRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.update(id, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update product');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useDeleteProduct = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteProduct = async (id: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.delete(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete product');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { deleteProduct, loading, error };
};

export const useApproveProduct = () => {
    const [loading, setLoading] = useState(false);

    const approve = async (id: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await productsApi.approve(id);
        } finally {
            setLoading(false);
        }
    };

    return { approve, loading };
};

export const useToggleProductStatus = () => {
    const [loading, setLoading] = useState(false);

    const toggleStatus = async (id: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await productsApi.toggleStatus(id);
        } finally {
            setLoading(false);
        }
    };

    return { toggleStatus, loading };
};

export const useBulkUpdateProducts = () => {
    const [loading, setLoading] = useState(false);

    const bulkUpdate = async (payload: BulkUpdateRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await productsApi.bulkUpdate(payload);
        } finally {
            setLoading(false);
        }
    };

    return { bulkUpdate, loading };
};

export const useProductStock = (id: number | null) => {
    const [data, setData] = useState<StockSummaryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStock = async () => {
        if (!id) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getStock(id);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch stock');
            console.error('Failed to fetch stock:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
    }, [id]);

    return { data, loading, error, refetch: fetchStock };
};

export const useProductStatistics = () => {
    const [data, setData] = useState<ProductStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getStatistics();
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
            console.error('Failed to fetch statistics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    return { data, loading, error, refetch: fetchStats };
};

export const useProductPackagings = (productId: number | null) => {
    const [data, setData] = useState<ProductPackagingListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPackagings = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getPackagings(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch packagings');
            console.error('Failed to fetch packagings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackagings();
    }, [productId]);

    return { data, loading, error, refetch: fetchPackagings };
};

export const useCreatePackaging = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async (payload: CreatePackagingRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.createPackaging(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create packaging');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { create, loading, error };
};

export const useUpdatePackaging = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (id: number, payload: UpdatePackagingRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updatePackaging(id, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update packaging');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useDeletePackaging = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deletePackaging = async (id: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.deletePackaging(id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete packaging');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { deletePackaging, loading, error };
};

export const useProductTranslations = (productId: number | null) => {
    const [data, setData] = useState<ProductTranslationsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTranslations = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getTranslations(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch translations');
            console.error('Failed to fetch translations:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTranslations();
    }, [productId]);

    return { data, loading, error, refetch: fetchTranslations };
};

export const useCreateTranslation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async (productId: number, payload: ProductTranslation): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.createTranslation(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create translation');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { create, loading, error };
};

export const useUpdateTranslation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, lang: string, payload: ProductTranslation): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateTranslation(productId, lang, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update translation');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useDeleteTranslation = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteTranslation = async (productId: number, lang: string): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.deleteTranslation(productId, lang);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete translation');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { deleteTranslation, loading, error };
};

export const useProductLogistics = (productId: number | null) => {
    const [data, setData] = useState<ProductLogisticsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLogistics = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getLogistics(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch logistics');
            console.error('Failed to fetch logistics:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogistics();
    }, [productId]);

    return { data, loading, error, refetch: fetchLogistics };
};

export const useUpdateLogistics = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, payload: ProductLogisticsProfile): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateLogistics(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update logistics');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useProductSuppliers = (productId: number | null) => {
    const [data, setData] = useState<ProductSuppliersResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSuppliers = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getSuppliers(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
            console.error('Failed to fetch suppliers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, [productId]);

    return { data, loading, error, refetch: fetchSuppliers };
};

export const useCreateProductSupplier = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async (productId: number, payload: CreateProductSupplierRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.createSupplier(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create supplier link');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { create, loading, error };
};

export const useUpdateProductSupplier = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, supplierId: number, payload: UpdateProductSupplierRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateSupplier(productId, supplierId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update supplier link');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useDeleteProductSupplier = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const deleteSupplier = async (productId: number, supplierId: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.deleteSupplier(productId, supplierId);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete supplier link');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { deleteSupplier, loading, error };
};

export const useProductRetailPrice = (productId: number | null) => {
    const [data, setData] = useState<ProductRetailPriceResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchRetailPrice = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getRetailPrice(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch retail price');
            console.error('Failed to fetch retail price:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRetailPrice();
    }, [productId]);

    return { data, loading, error, refetch: fetchRetailPrice };
};

export const useUpdateRetailPrice = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, payload: ProductRetailPrice): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateRetailPrice(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update retail price');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useProductFlags = (productId: number | null) => {
    const [data, setData] = useState<ProductFlagsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFlags = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getFlags(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch flags');
            console.error('Failed to fetch flags:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFlags();
    }, [productId]);

    return { data, loading, error, refetch: fetchFlags };
};

export const useUpdateProductFlags = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, payload: Partial<ProductFlags>): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateFlags(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update flags');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useProductMarketing = (productId: number | null) => {
    const [data, setData] = useState<ProductMarketingResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMarketing = async () => {
        if (!productId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getMarketing(productId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch marketing');
            console.error('Failed to fetch marketing:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMarketing();
    }, [productId]);

    return { data, loading, error, refetch: fetchMarketing };
};

export const useUpdateProductMarketing = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (productId: number, payload: Partial<ProductMarketing>): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await productsApi.updateMarketing(productId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update marketing');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useProductSalesGroups = () => {
    const [data, setData] = useState<ProductSalesGroupsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchGroups = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getProductSalesGroups({ paginate: false });
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch sales groups');
            console.error('Failed to fetch sales groups:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    return { data, loading, error, refetch: fetchGroups };
};

export const useProductPages = () => {
    const [data, setData] = useState<ProductPagesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPages = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await productsApi.getProductPages();
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch product pages');
            console.error('Failed to fetch product pages:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPages();
    }, []);

    return { data, loading, error, refetch: fetchPages };
};

// ─── Subcategories dropdown list ─────────────────────────────────────────────

// Handles all common Laravel list response shapes:
// 1. [...] direct array
// 2. { data: [...] }  plain envelope
// 3. { data: { data: [...] } }  paginated inside envelope
// 4. { current_page, data: [...] }  raw Laravel paginator (no envelope)
const extractList = (body: any): any[] => {
    if (Array.isArray(body)) return body;                                    // [...] direct
    if (Array.isArray(body?.data)) return body.data;                        // { data: [...] }
    if (Array.isArray(body?.data?.data)) return body.data.data;             // { data: { data: [...] } } paginated
    if (Array.isArray(body?.data?.categories)) return body.data.categories; // { data: { categories: [...] } } ← THE MISSING CASE
    if (Array.isArray(body?.data?.subcategories)) return body.data.subcategories;
    if (Array.isArray(body?.categories)) return body.categories;            // { categories: [...] }
    if (Array.isArray(body?.subcategories)) return body.subcategories;
    if (Array.isArray(body?.items)) return body.items;
    return [];
};

export const useCategoriesList = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);

        // Primary: master-data/categories endpoint (paginate=false to get full list)
        productsApi.getCategories({ paginate: false })
            .then(res => {
                // getCategories returns { success, data?: Category[] }
                const list = extractList(res);
                console.debug('[useCategoriesList] master-data/categories raw:', res, '→ extracted:', list.length);
                if (list.length > 0) {
                    setData(list);
                    return;
                }
                // Fallback: legacy /categories endpoint
                return productsApi.getCategoriesList().then(fallbackRes => {
                    const fallbackList = extractList(fallbackRes);
                    console.debug('[useCategoriesList] /categories fallback raw:', fallbackRes, '→ extracted:', fallbackList.length);
                    setData(fallbackList);
                });
            })
            .catch((err) => {
                console.error('[useCategoriesList] failed:', err?.response?.status, err?.message);
                // Last resort: legacy /categories endpoint
                productsApi.getCategoriesList()
                    .then(res => setData(extractList(res)))
                    .catch(() => setData([]));
            })
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
};

export const useSubcategoriesList = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        // Primary: master-data/sub-categories endpoint
        productsApi.getSubcategories({ paginate: false })
            .then(res => {
                const list = extractList(res);
                console.debug('[useSubcategoriesList] master-data/sub-categories raw:', res, '→ extracted:', list.length);
                if (list.length > 0) {
                    setData(list);
                    return;
                }
                // Fallback: legacy /subcategories endpoint
                return productsApi.getSubcategoriesList().then(fallbackRes => {
                    const fallbackList = extractList(fallbackRes);
                    console.debug('[useSubcategoriesList] /subcategories fallback raw:', fallbackRes, '→ extracted:', fallbackList.length);
                    setData(fallbackList);
                });
            })
            .catch((err) => {
                console.error('[useSubcategoriesList] failed:', err?.response?.status, err?.message);
                productsApi.getSubcategoriesList()
                    .then(res => setData(extractList(res)))
                    .catch(() => setData([]));
            })
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
};

// ─── Per-product facet hooks (§7.1–§7.8) ─────────────────────────────────────

export const useProductCategories = (productId: number | null) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = async () => {
        if (!productId) { setData([]); return; }
        setLoading(true);
        try {
            const res = await productsApi.getProductCategories(productId);
            setData(res.categories ?? []);
        } catch { setData([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [productId]);
    return { data, loading, refetch: fetch };
};

export const useUpdateProductCategories = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, categoryIds: number[]): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductCategories(productId, categoryIds); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useProductSubcategories = (productId: number | null) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = async () => {
        if (!productId) { setData([]); return; }
        setLoading(true);
        try {
            const res = await productsApi.getProductSubcategories(productId);
            setData(res.subcategories ?? []);
        } catch { setData([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [productId]);
    return { data, loading, refetch: fetch };
};

export const useUpdateProductSubcategories = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, ids: number[]): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductSubcategories(productId, ids); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useProductVatTaxesFacet = (productId: number | null) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetch = async () => {
        if (!productId) { setData([]); return; }
        setLoading(true);
        try {
            const res = await productsApi.getProductVatTaxesFacet(productId);
            setData(res.vat_taxes ?? []);
        } catch { setData([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [productId]);
    return { data, loading, refetch: fetch };
};

export const useUpdateProductVatTaxes = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, vatTaxIds: number[]): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductVatTaxesFacet(productId, vatTaxIds); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useProductPageFacet = (productId: number | null) => {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = async () => {
        if (!productId) { setData(null); return; }
        setLoading(true);
        try {
            const res = await productsApi.getProductPageFacet(productId);
            setData(res.product_page ?? null);
        } catch { setData(null); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [productId]);
    return { data, loading, refetch: fetch };
};

export const useUpdateProductPageFacet = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, code: string | null): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductPageFacet(productId, code); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useProductSalesGroupFacet = (productId: number | null) => {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);

    const fetch = async () => {
        if (!productId) { setData(null); return; }
        setLoading(true);
        try {
            const res = await productsApi.getProductSalesGroupFacet(productId);
            setData(res.product_sales_group ?? null);
        } catch { setData(null); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetch(); }, [productId]);
    return { data, loading, refetch: fetch };
};

export const useUpdateProductSalesGroupFacet = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, code: string | null): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductSalesGroupFacet(productId, code); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useUpdateProductBrand = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, brandId: number | null): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductBrand(productId, brandId); }
        finally { setLoading(false); }
    };
    return { update, loading };
};

export const useUpdateProductUnit = () => {
    const [loading, setLoading] = useState(false);
    const update = async (productId: number, unitId: number | null): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try { return await productsApi.updateProductUnit(productId, unitId); }
        finally { setLoading(false); }
    };
    return { update, loading };
};
