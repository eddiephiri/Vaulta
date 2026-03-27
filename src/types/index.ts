// ─── Workspace ──────────────────────────────────────────────────────────────

export interface Workspace {
    id: string;
    name: string;
    description?: string;
    created_at: string;
}

export interface WorkspaceUser {
    id: string;
    workspace_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member' | 'guest';
    last_active_workspace: boolean;
    expires_at?: string | null;
    authorized_apps?: string[] | null;
    created_at: string;
    workspace?: Workspace;
}

export interface WorkspaceAccessCode {
    id: string;
    code: string;
    workspace_id: string;
    role: 'member' | 'guest';
    authorized_apps?: string[] | null;
    expires_at?: string | null;
    created_by?: string;
    created_at: string;
}

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
    /** The real-world start of week 1. Defaults to schedule created_at. */
    anchor_date?: string | null;
    active: boolean;
    notes?: string;
    created_at: string;
}

// ─── Expected Cashings ────────────────────────────────────────────────────────

export type CashingStatus = 'pending' | 'recorded' | 'late_driver' | 'late_admin' | 'deferred_to_salary';

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

// ─── Shared Ledger Transactions ────────────────────────────────────────────────

export interface TransactionRecord {
    id: string;
    workspace_id: string;
    app_id: string;
    type: 'income' | 'expense' | 'transfer';
    amount_zmw: number;
    date: string;
    description?: string;
    linked_transaction_id?: string | null;
    reference_entity_id?: string | null;
    created_by?: string | null;
    created_at: string;
    metadata: Record<string, any>;
    // Joined vehicle for convenience
    vehicle?: Pick<Vehicle, 'id' | 'plate' | 'make' | 'model'>;
    driver?: Pick<Driver, 'id' | 'name'>;
}

// ─── Income ──────────────────────────────────────────────────────────────────

export interface IncomeMetadata {
    source: IncomeSource;
    period_start?: string | null;
    period_end?: string | null;
    driver_id?: string | null;
    expected_cashing_id?: string | null;
    reference?: string;
    notes?: string;
}

export interface IncomeRecord extends TransactionRecord {
    type: 'income';
    metadata: IncomeMetadata;
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

export interface ExpenseMetadata {
    category: ExpenseCategory;
    source_table?: 'service_history' | 'tyre_changes' | 'licensing' | null;
    source_id?: string | null;
    driver_id?: string | null;
    notes?: string;
}

export interface ExpenseRecord extends TransactionRecord {
    type: 'expense';
    metadata: ExpenseMetadata;
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

// ─── Budget Accounts ─────────────────────────────────────────────────────────

export type BudgetAccountType = 'bank' | 'mobile_money' | 'cash' | 'savings';

export interface BudgetAccount {
    id: string;
    workspace_id: string;
    name: string;
    type: BudgetAccountType;
    currency: string;
    color: string;
    notes?: string;
    created_at: string;
}

// ─── Budget Categories ───────────────────────────────────────────────────────

export type BudgetCategoryType = 'income' | 'expense';

export interface BudgetCategory {
    id: string;
    workspace_id: string;
    name: string;
    type: BudgetCategoryType;
    color: string;
    icon?: string;
    created_at: string;
}

// ─── Budget Transactions ─────────────────────────────────────────────────────

export interface BudgetTransactionMetadata {
    category_id?: string | null;
    account_id?: string | null;
    notes?: string;
    // Denormalised for display (avoids extra joins)
    category_name?: string;
    account_name?: string;
}

export interface BudgetIncomeRecord extends TransactionRecord {
    type: 'income';
    metadata: BudgetTransactionMetadata;
}

export interface BudgetExpenseRecord extends TransactionRecord {
    type: 'expense';
    metadata: BudgetTransactionMetadata;
}
