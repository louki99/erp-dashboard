export type OptimizationObjective = 'minimize_distance' | 'minimize_duration';
export type BatchStatus = 'success' | 'error';                                      // optimize-dispatch operation result
export type BatchLifecycleStatus = 'processing' | 'completed' | 'confirmed' | 'cancelled' | 'failed'; // batch state machine
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface OptimizeOrderInput {
    order_id: number;
    customer_id: number;
    customer_name: string;
    address: string;
    latitude: number;
    longitude: number;
    weight_kg: number;
    volume_m3: number;
    priority?: number;
}

export interface OptimizeDispatchRequest {
    batch_id: string;
    batch_name: string;
    depot_latitude: number;
    depot_longitude: number;
    orders: OptimizeOrderInput[];
    optimization_objective?: OptimizationObjective;
}

// bounding_box points are [longitude, latitude] — GeoJSON order
export type BBoxPoint = [number, number];

export interface TourStop {
    sequence_order: number;
    customer_name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface OptimizedTour {
    tour_number: number;
    vehicle_plate: string;
    driver_name: string;
    stops: TourStop[];
    total_distance_meters: number;
    total_duration_seconds: number;
    stop_count: number;
    bounding_box: BBoxPoint[];
}

export interface OptimizeDispatchResponse {
    batch_id: string;
    status: BatchStatus;
    total_orders: number;
    total_tours: number;
    tours: OptimizedTour[];
    optimization_score: number;
    message?: string;
}

export interface ConfirmBatchResponse {
    status: 'confirmed';
    batch_id: string;
}

export interface CancelBatchResponse {
    status: 'cancelled';
    batch_id: string;
}

export interface BatchSummary {
    batch_id: string;
    batch_name: string;
    status: BatchLifecycleStatus;
    total_orders: number;
    total_customers: number;
    total_weight_kg: number;
    total_volume_m3: number;
    total_tours: number;
    optimization_score: number;
    error_message: string | null;
    created_at: string;
    completed_at: string | null;
    confirmed_at: string | null;
}

export interface OptimizerHealth {
    status: HealthStatus;
    database_connected: boolean;
    osrm_connected: boolean;
    solver_connected: boolean;
}
