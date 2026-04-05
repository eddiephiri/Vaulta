import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { BudgetSheet, BudgetSheetItem, BudgetSheetWithTotals, BudgetSheetStatus } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function attachTotals(
    sheet: BudgetSheet,
    items: BudgetSheetItem[],
): BudgetSheetWithTotals {
    const sheetItems = items.filter(i => i.sheet_id === sheet.id);
    const purchased = sheetItems.filter(i => i.is_purchased);
    const totalEstimated = sheetItems.reduce((s, i) => s + Number(i.estimated_zmw), 0);
    // totalActual: for purchased items use actual (fallback estimated), for pending use estimated
    const totalActual = sheetItems.reduce((s, i) => {
        if (i.is_purchased) return s + Number(i.actual_zmw ?? i.estimated_zmw);
        return s + Number(i.estimated_zmw);
    }, 0);
    const totalPaid = purchased.reduce((s, i) => s + Number(i.actual_zmw ?? i.estimated_zmw), 0);

    return {
        ...sheet,
        items: sheetItems.sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
        totalItems: sheetItems.length,
        purchasedCount: purchased.length,
        totalEstimated,
        totalActual,
        totalPaid,
    };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddSheetPayload {
    name: string;
    description?: string | null;
    month?: string | null;
    notes?: string | null;
}

export interface UpdateSheetPayload extends Partial<AddSheetPayload> {
    status?: BudgetSheetStatus;
}

export interface AddItemPayload {
    name: string;
    category?: string | null;
    estimated_zmw: number;
    notes?: string | null;
}

export interface UpdateItemPayload extends Partial<AddItemPayload> {
    actual_zmw?: number | null;
    is_purchased?: boolean;
    purchased_at?: string | null;
}

export interface UseBudgetSheetsReturn {
    sheets: BudgetSheetWithTotals[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    // Sheet CRUD
    addSheet: (payload: AddSheetPayload) => Promise<BudgetSheet | null>;
    updateSheet: (id: string, payload: UpdateSheetPayload) => Promise<boolean>;
    deleteSheet: (id: string) => Promise<boolean>;
    // Item CRUD
    addItem: (sheetId: string, payload: AddItemPayload) => Promise<BudgetSheetItem | null>;
    updateItem: (id: string, payload: UpdateItemPayload) => Promise<boolean>;
    deleteItem: (id: string) => Promise<boolean>;
    togglePurchased: (item: BudgetSheetItem) => Promise<boolean>;
    setActualPrice: (id: string, actual_zmw: number | null) => Promise<boolean>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBudgetSheets(): UseBudgetSheetsReturn {
    const [sheets, setSheets] = useState<BudgetSheetWithTotals[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);

        const [sheetsRes, itemsRes] = await Promise.all([
            supabase
                .from('budget_sheets')
                .select('*')
                .order('created_at', { ascending: false }),
            supabase
                .from('budget_sheet_items')
                .select('*')
                .order('sort_order', { ascending: true }),
        ]);

        if (sheetsRes.error) { setError(sheetsRes.error.message); setLoading(false); return; }
        if (itemsRes.error)  { setError(itemsRes.error.message);  setLoading(false); return; }

        const rawSheets = (sheetsRes.data ?? []) as BudgetSheet[];
        const rawItems  = (itemsRes.data  ?? []) as BudgetSheetItem[];

        setSheets(rawSheets.map(s => attachTotals(s, rawItems)));
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Sheet CRUD ───────────────────────────────────────────────────────────

    const addSheet = async (payload: AddSheetPayload): Promise<BudgetSheet | null> => {
        const { data, error: err } = await supabase
            .from('budget_sheets')
            .insert(payload)
            .select()
            .single();
        if (err) { setError(err.message); return null; }
        await fetchAll();
        return data as BudgetSheet;
    };

    const updateSheet = async (id: string, payload: UpdateSheetPayload): Promise<boolean> => {
        const { error: err } = await supabase
            .from('budget_sheets')
            .update(payload)
            .eq('id', id);
        if (err) { setError(err.message); return false; }
        await fetchAll();
        return true;
    };

    const deleteSheet = async (id: string): Promise<boolean> => {
        const { error: err } = await supabase
            .from('budget_sheets')
            .delete()
            .eq('id', id);
        if (err) { setError(err.message); return false; }
        await fetchAll();
        return true;
    };

    // ── Item CRUD ────────────────────────────────────────────────────────────

    const addItem = async (sheetId: string, payload: AddItemPayload): Promise<BudgetSheetItem | null> => {
        // Determine next sort_order
        const existingSheet = sheets.find(s => s.id === sheetId);
        const nextOrder = existingSheet ? existingSheet.items.length : 0;

        const { data, error: err } = await supabase
            .from('budget_sheet_items')
            .insert({ ...payload, sheet_id: sheetId, sort_order: nextOrder })
            .select()
            .single();
        if (err) { setError(err.message); return null; }
        await fetchAll();
        return data as BudgetSheetItem;
    };

    const updateItem = async (id: string, payload: UpdateItemPayload): Promise<boolean> => {
        const { error: err } = await supabase
            .from('budget_sheet_items')
            .update(payload)
            .eq('id', id);
        if (err) { setError(err.message); return false; }
        await fetchAll();
        return true;
    };

    const deleteItem = async (id: string): Promise<boolean> => {
        const { error: err } = await supabase
            .from('budget_sheet_items')
            .delete()
            .eq('id', id);
        if (err) { setError(err.message); return false; }
        await fetchAll();
        return true;
    };

    const togglePurchased = async (item: BudgetSheetItem): Promise<boolean> => {
        const nowPurchased = !item.is_purchased;
        return updateItem(item.id, {
            is_purchased: nowPurchased,
            purchased_at: nowPurchased ? new Date().toISOString() : null,
        });
    };

    const setActualPrice = async (id: string, actual_zmw: number | null): Promise<boolean> => {
        return updateItem(id, { actual_zmw });
    };

    return {
        sheets,
        loading,
        error,
        refetch: fetchAll,
        addSheet,
        updateSheet,
        deleteSheet,
        addItem,
        updateItem,
        deleteItem,
        togglePurchased,
        setActualPrice,
    };
}
