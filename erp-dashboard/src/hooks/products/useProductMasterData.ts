import { useEffect, useState } from 'react';
import { productsApi } from '@/services/api/productsApi';
import type {
    ApiSuccessResponse,
    Brand,
    Category,
    Unit,
    VatTax,
    Supplier,
    ProductSalesGroup,
    ProductPage,
} from '@/types/product.types';

// ─── Generic factory for simple master-data resources ─────────────────────────

interface ListResponse<T> {
    success: boolean;
    data?: T[];
    [key: string]: any;
}

function createListHook<T>(
    resourceKey: string,
    fetcher: () => Promise<ListResponse<T>>,
    deps: any[] = []
) {
    return () => {
        const [data, setData] = useState<T[] | null>(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        const fetch = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetcher();
                let list = res.data ?? res[resourceKey];
                if (!Array.isArray(list) && list && Array.isArray(list.data)) {
                    list = list.data;
                }
                if (!Array.isArray(list)) {
                    const nested = res[resourceKey];
                    list = nested && Array.isArray(nested.data) ? nested.data : [];
                }
                setData(Array.isArray(list) ? list : []);
            } catch (err) {
                setError(err instanceof Error ? err.message : `Failed to fetch ${resourceKey}`);
                console.error(`Failed to fetch ${resourceKey}:`, err);
            } finally {
                setLoading(false);
            }
        };

        useEffect(() => {
            fetch();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, deps);

        return { data: data ?? [], loading, error, refetch: fetch };
    };
}

function createMutationHook<Req>(
    mutator: (payload: Req) => Promise<ApiSuccessResponse>,
    actionName: string
) {
    return () => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const execute = async (payload: Req): Promise<ApiSuccessResponse> => {
            setLoading(true);
            setError(null);
            try {
                return await mutator(payload);
            } catch (err) {
                setError(err instanceof Error ? err.message : `Failed to ${actionName}`);
                throw err;
            } finally {
                setLoading(false);
            }
        };

        return { execute, loading, error };
    };
}

function createIdMutationHook<Id, Req>(
    mutator: (id: Id, payload: Req) => Promise<ApiSuccessResponse>,
    actionName: string
) {
    return () => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const execute = async (id: Id, payload: Req): Promise<ApiSuccessResponse> => {
            setLoading(true);
            setError(null);
            try {
                return await mutator(id, payload);
            } catch (err) {
                setError(err instanceof Error ? err.message : `Failed to ${actionName}`);
                throw err;
            } finally {
                setLoading(false);
            }
        };

        return { execute, loading, error };
    };
}

function createDeleteHook<Id>(
    mutator: (id: Id) => Promise<ApiSuccessResponse>,
    actionName: string
) {
    return () => {
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);

        const execute = async (id: Id): Promise<ApiSuccessResponse> => {
            setLoading(true);
            setError(null);
            try {
                return await mutator(id);
            } catch (err) {
                setError(err instanceof Error ? err.message : `Failed to ${actionName}`);
                throw err;
            } finally {
                setLoading(false);
            }
        };

        return { execute, loading, error };
    };
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export const useBrands = createListHook<Brand>('brands', () => productsApi.getBrands({ paginate: false }));
export const useCreateBrand = createMutationHook<Partial<Brand>>((payload) => productsApi.createBrand(payload), 'create brand');
export const useUpdateBrand = createIdMutationHook<number, Partial<Brand>>((id, payload) => productsApi.updateBrand(id, payload), 'update brand');
export const useDeleteBrand = createDeleteHook<number>((id) => productsApi.deleteBrand(id), 'delete brand');
export const useToggleBrand = createDeleteHook<number>((id) => productsApi.toggleBrand(id), 'toggle brand');

// ─── Categories ───────────────────────────────────────────────────────────────

export const useCategories = createListHook<Category>('categories', () => productsApi.getCategories({ paginate: false }));
export const useCreateCategory = createMutationHook<Partial<Category>>((payload) => productsApi.createCategory(payload), 'create category');
export const useUpdateCategory = createIdMutationHook<number, Partial<Category>>((id, payload) => productsApi.updateCategory(id, payload), 'update category');
export const useDeleteCategory = createDeleteHook<number>((id) => productsApi.deleteCategory(id), 'delete category');
export const useToggleCategory = createDeleteHook<number>((id) => productsApi.toggleCategory(id), 'toggle category');
export const useUploadCategoryImage = createIdMutationHook<number, File>((id, file) => productsApi.uploadCategoryImage(id, file), 'upload category image');
export const useDeleteCategoryImage = createDeleteHook<number>((id) => productsApi.deleteCategoryImage(id), 'delete category image');

// ─── Sub-categories ───────────────────────────────────────────────────────────

export const useSubcategories = createListHook<Category>('subcategories', () => productsApi.getSubcategories({ paginate: false }));
export const useCreateSubcategory = createMutationHook<Partial<Category>>((payload) => productsApi.createSubcategory(payload), 'create subcategory');
export const useUpdateSubcategory = createIdMutationHook<number, Partial<Category>>((id, payload) => productsApi.updateSubcategory(id, payload), 'update subcategory');
export const useDeleteSubcategory = createDeleteHook<number>((id) => productsApi.deleteSubcategory(id), 'delete subcategory');
export const useToggleSubcategory = createDeleteHook<number>((id) => productsApi.toggleSubcategory(id), 'toggle subcategory');

// ─── Units ────────────────────────────────────────────────────────────────────

export const useUnits = createListHook<Unit>('units', () => productsApi.getUnits({ paginate: false }));
export const useCreateUnit = createMutationHook<Partial<Unit>>((payload) => productsApi.createUnit(payload), 'create unit');
export const useUpdateUnit = createIdMutationHook<number, Partial<Unit>>((id, payload) => productsApi.updateUnit(id, payload), 'update unit');
export const useDeleteUnit = createDeleteHook<number>((id) => productsApi.deleteUnit(id), 'delete unit');
export const useToggleUnit = createDeleteHook<number>((id) => productsApi.toggleUnit(id), 'toggle unit');

// ─── VAT Taxes ────────────────────────────────────────────────────────────────

export const useVatTaxes = createListHook<VatTax>('vatTaxes', () => productsApi.getVatTaxes({ paginate: false }));
export const useCreateVatTax = createMutationHook<Partial<VatTax>>((payload) => productsApi.createVatTax(payload), 'create VAT tax');
export const useUpdateVatTax = createIdMutationHook<number, Partial<VatTax>>((id, payload) => productsApi.updateVatTax(id, payload), 'update VAT tax');
export const useDeleteVatTax = createDeleteHook<number>((id) => productsApi.deleteVatTax(id), 'delete VAT tax');
export const useToggleVatTax = createDeleteHook<number>((id) => productsApi.toggleVatTax(id), 'toggle VAT tax');

// ─── Suppliers ─────────────────────────────────────────────────────────────────

export const useSuppliersList = createListHook<Supplier>('suppliers', () => productsApi.getSuppliersList({ paginate: false }));
export const useCreateSupplier = createMutationHook<Partial<Supplier>>((payload) => productsApi.createSupplierMaster(payload), 'create supplier');
export const useUpdateSupplier = createIdMutationHook<number, Partial<Supplier>>((id, payload) => productsApi.updateSupplierMaster(id, payload), 'update supplier');
export const useDeleteSupplier = createDeleteHook<number>((id) => productsApi.deleteSupplierMaster(id), 'delete supplier');
export const useToggleSupplier = createDeleteHook<number>((id) => productsApi.toggleSupplierMaster(id), 'toggle supplier');

// ─── Product Sales Groups ─────────────────────────────────────────────────────

export const useProductSalesGroupsList = createListHook<ProductSalesGroup>('groups', () => productsApi.getProductSalesGroups({ paginate: false }));
export const useCreateProductSalesGroup = createMutationHook<Partial<ProductSalesGroup>>((payload) => productsApi.createProductSalesGroup(payload), 'create sales group');
export const useUpdateProductSalesGroup = createIdMutationHook<string, Partial<ProductSalesGroup>>((code, payload) => productsApi.updateProductSalesGroup(code, payload), 'update sales group');
export const useDeleteProductSalesGroup = createDeleteHook<string>((code) => productsApi.deleteProductSalesGroup(code), 'delete sales group');
export const useToggleProductSalesGroup = createDeleteHook<string>((code) => productsApi.toggleProductSalesGroup(code), 'toggle sales group');

// ─── Product Pages ────────────────────────────────────────────────────────────

export const useProductPagesList = createListHook<ProductPage>('pages', () => productsApi.getProductPages());
export const useCreateProductPage = createMutationHook<Partial<ProductPage>>((payload) => productsApi.createProductPage(payload), 'create product page');
export const useUpdateProductPage = createIdMutationHook<string, Partial<ProductPage>>((code, payload) => productsApi.updateProductPage(code, payload), 'update product page');
export const useDeleteProductPage = createDeleteHook<string>((code) => productsApi.deleteProductPage(code), 'delete product page');
