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

// ─── Drivers ─────────────────────────────────────────────────────────────────

export interface Driver {
    id: string;
    name: string;
    phone?: string;
    license_number?: string;
    vehicle_id?: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    salary_zmw: number;
    hire_date?: string;
    active: boolean;
    notes?: string;
    created_at: string;
}

// ─── Cashing Schedules ───────────────────────────────────────────────────────

export type IncomeSource = 'yango' | 'public_transport' | 'rental' | 'other';

export type CashingDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun … 6=Sat

export interface CashingSchedule {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    income_source: IncomeSource;
    cashing_day_of_week?: CashingDayOfWeek | null; // null = no fixed day
    cycle_weeks: number;         // total weeks in cycle (default 4)
    salary_week: number;         // which week is pay week (default 4)
    active: boolean;
    notes?: string;
    created_at: string;
}

// ─── Expected Cashings ────────────────────────────────────────────────────────

export type CashingStatus = 'pending' | 'recorded' | 'late_driver' | 'late_admin';

export interface ExpectedCashing {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    schedule_id?: string;
    expected_date: string;
    is_salary_week: boolean;
    week_number: number;
    income_record_id?: string | null;
    status: CashingStatus;
    notes?: string;
    created_at: string;
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
    reminder_days_before: number;
    notes?: string;
    created_at: string;
}

// ─── Income ──────────────────────────────────────────────────────────────────

export interface IncomeRecord {
    id: string;
    vehicle_id: string;
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    date: string;
    amount_zmw: number;
    source: IncomeSource;
    // Period the cashing covers (gross income approach)
    period_start?: string | null;
    period_end?: string | null;
    // Optional driver who handed in the cashing
    driver_id?: string | null;
    driver?: Pick<Driver, 'id' | 'name'>;
    // Links back to the expected cashing row (if logged from a reminder)
    expected_cashing_id?: string | null;
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
    // Set by database trigger — null means manually entered
    source_table?: 'service_history' | 'tyre_changes' | 'licensing' | null;
    source_id?: string | null;
    // Driver being paid (salary entries only)
    driver_id?: string | null;
    driver?: Pick<Driver, 'id' | 'name'>;
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

