// ─── Vehicle ────────────────────────────────────────────────────────────────

export type VehicleStatus = 'active' | 'inactive' | 'maintenance';

export interface Vehicle {
    id: string;
    plate: string;
    make: string;
    model: string;
    year: number;
    color: string;
    status: VehicleStatus;
    odometer_km: number;
    created_at: string;
    updated_at: string;
}

// ─── Service History ─────────────────────────────────────────────────────────

export interface ServiceRecord {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    date: string; // ISO date string
    description: string;
    service_provider?: string;
    cost_zmw: number;
    odometer_km?: number;
    notes?: string;
    created_at: string;
}

// ─── Tyre Changes ────────────────────────────────────────────────────────────

export type TyrePosition =
    | 'front_left'
    | 'front_right'
    | 'rear_left'
    | 'rear_right'
    | 'spare';

export interface TyreChange {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    date: string;
    position: TyrePosition;
    brand?: string;
    tyre_size?: string;
    cost_zmw: number;
    odometer_km?: number;
    notes?: string;
    created_at: string;
}

// ─── Licensing ───────────────────────────────────────────────────────────────

export type LicenseType =
    | 'road_tax'
    | 'fitness_certificate'
    | 'insurance'
    | 'council_permit'
    | 'other';

export interface LicenseRecord {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    license_type: LicenseType;
    issued_date: string;
    expiry_date: string;
    cost_zmw: number;
    document_url?: string;
    reminder_days_before: number; // send push notification X days before expiry
    notes?: string;
    created_at: string;
}

// ─── Income ──────────────────────────────────────────────────────────────────

export type IncomeSource = 'yango' | 'rental' | 'other';

export interface IncomeRecord {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    date: string;
    amount_zmw: number;
    source: IncomeSource;
    reference?: string;
    notes?: string;
    created_at: string;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export type ExpenseCategory =
    | 'fuel'
    | 'service'
    | 'tyre'
    | 'licensing'
    | 'insurance'
    | 'repairs'
    | 'salary'
    | 'wash'
    | 'other';

export interface ExpenseRecord {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    date: string;
    amount_zmw: number;
    category: ExpenseCategory;
    description?: string;
    notes?: string;
    // set by database trigger — null means manually entered
    source_table?: 'service_history' | 'tyre_changes' | 'licensing' | null;
    source_id?: string | null;
    created_at: string;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface DateRange {
    from: string;
    to: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    count: number;
    page: number;
    pageSize: number;
}
