export interface BonPreparation {
    id: number;
    bp_number: string;
    status: 'pending' | 'in_progress' | 'completed' | 'rejected';
    bon_chargement_id?: number;
    magasinier_id?: number;
    notes?: string;
    rejection_reason?: string;
    created_at: string;
    updated_at: string;
    prepared_at?: string;
    rejected_at?: string;
    bonChargement?: BonChargement;
    items?: BonPreparationItem[];
    magasinier?: Magasinier;
}

export interface BonPreparationItem {
    id: number;
    bon_preparation_id: number;
    product_id: number;
    requested_quantity: number;
    available_quantity: number;
    prepared_quantity?: number;
    product?: Product;
}

export interface BonChargement {
    id: number;
    bch_number: string;
    status: string;
    livreur_id?: number;
    livreur?: Livreur;
    bonLivraisons?: BonLivraison[];
}

export interface BonLivraison {
    id: number;
    bl_number: string;
    status: string;
    partner_id?: number;
    partner?: Partner;
}

export interface Livreur {
    id: number;
    name: string;
    email: string;
}

export interface Partner {
    id: number;
    name: string;
    code?: string;
}

export interface Product {
    id: number;
    name: string;
    code: string;
    unit?: string;
}

export interface Magasinier {
    id: number;
    name: string;
    email: string;
}

export interface Stock {
    id: number;
    product_id: number;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    min_stock_level?: number;
    product?: Product;
}

export interface StockMovement {
    id: number;
    product_id: number;
    type: 'in' | 'out' | 'adjustment' | 'reservation' | 'release';
    quantity: number;
    notes?: string;
    user_id?: number;
    created_at: string;
    product?: Product;
    user?: { id: number; name: string };
}

export interface DashboardStats {
    pendingPreparations: number;
    inProgress: number;
    completedToday: number;
    lowStockItems: number;
    readyToPrepare: number;
    pendingBps?: BonPreparation[];
}

export interface BatchPickingSession {
    id: number;
    status: 'active' | 'completed';
    created_at: string;
    completed_at?: string;
}

export interface PreparationsResponse {
    success: boolean;
    data?: {
        bonPreparations: {
            data: BonPreparation[];
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
        };
    };
}

export interface BonPreparationDetailResponse {
    success: boolean;
    data?: {
        bonPreparation: BonPreparation;
    };
}

export interface StockResponse {
    success: boolean;
    data?: {
        stock: {
            data: Stock[];
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
        };
    };
}

export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
    redirect?: string;
    bp_id?: number;
}

export interface SavePreparationRequest {
    prepared_quantities: Record<string, number>;
    notes?: string;
}

export interface RejectPreparationRequest {
    rejection_reason: string;
}

export interface StockAdjustmentRequest {
    product_id: number;
    adjustment_type: 'add' | 'remove';
    quantity: number;
    notes?: string;
}
