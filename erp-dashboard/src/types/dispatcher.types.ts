export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page?: number;
    per_page?: number;
    total: number;
}

export interface DispatcherDashboardData {
    stats?: Record<string, any>;
}

export interface DispatcherOrder {
    id: number;
    bc_number?: string;
    order_number?: string;
    order_code?: string;
    created_at?: string;
    total_amount?: string | number;
    bc_status?: string;
    partner?: {
        id: number;
        name: string;
        code?: string;
    };
}

export type DispatcherOrdersPendingResponse = PaginatedResponse<DispatcherOrder>;

export interface DispatcherOrderDetailResponse {
    order: DispatcherOrder;
}

export interface ConvertToBlResponse extends ApiSuccessResponse {
    bl_id?: number;
}

export interface Livreur {
    id: number;
    name: string;
    email: string;
}

export interface BonLivraisonItem {
    id: number;
    product_id?: number;
    product_name?: string;
    allocated_quantity?: number;
    unit_price?: number;
    product?: {
        id: number;
        name: string;
        code?: string;
    };
}

export interface BonLivraison {
    id: number;
    bl_number?: string;
    status?: string;
    delivery_date?: string;
    livreur_id?: number;
    livreur?: Livreur;
    notes?: string;
    items?: BonLivraisonItem[];
    bon_commande?: any;
    partner?: any;
    total_amount?: string;
    bon_commande_id?: number;
    partner_id?: number;
    parent_bl_id?: number;
    parent_bl?: BonLivraison;
    child_bls?: BonLivraison[];
}

export interface DraftBonLivraisonsResponse {
    draftBls: BonLivraison[];
    livreurs: Livreur[];
}

export interface BonLivraisonsResponse {
    bls: PaginatedResponse<BonLivraison>;
}

export interface BonLivraisonDetailResponse {
    bl: BonLivraison;
    livreurs?: Livreur[];
}

export interface UpdateBonLivraisonRequest {
    delivery_date?: string;
    livreur_id?: number;
    notes?: string;
    items?: Array<{
        id: number;
        allocated_quantity: number;
        unit_price?: number;
    }>;
}

export interface CreateBchRequest {
    bl_ids: string;
    livreur_id: number;
    notes?: string;
}

export interface BonChargement {
    id: number;
    bch_number?: string;
    status?: string;
    livreur_id?: number;
    livreur?: Livreur;
    bon_livraisons?: BonLivraison[];
    notes?: string;
    created_at?: string;
    submitted_at?: string;
    validated_at?: string;
    cancelled_at?: string;
    completed_at?: string;
}

export interface BonChargementsResponse {
    bchs: PaginatedResponse<BonChargement>;
}

export interface BonChargementDetailResponse {
    bch: BonChargement;
}

export interface BalanceResponse {
    allocations: Record<string, Record<string, number>>;
}

export interface UpdateBalanceRequest {
    allocations: Record<string, Record<string, number>>;
}

export interface SplitBlRequest {
    splits: Array<{
        items: number[];
        notes?: string;
    }>;
}

export interface SplitBlResponse extends ApiSuccessResponse {
    data?: {
        parent_bl: BonLivraison;
        child_bls: BonLivraison[];
    };
}

// Decharges types
export interface Decharge {
    id: number;
    decharge_number?: string;
    type?: string; // 'delivery' | 'return'
    status?: string;
    bl_id?: number;
    bl_number?: string;
    livreur_id?: number;
    livreur?: Livreur;
    created_at?: string;
    items?: DechargeItem[];
}

export interface DechargeItem {
    id: number;
    product_id?: number;
    product_name?: string;
    delivered_quantity?: number;
    returned_quantity?: number;
    return_reason?: string;
}

export interface DechargesResponse {
    decharges: PaginatedResponse<Decharge>;
}

export interface DechargeDetailResponse {
    decharge: Decharge;
}
