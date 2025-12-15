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
