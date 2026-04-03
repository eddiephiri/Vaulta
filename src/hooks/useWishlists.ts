import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import type { WishlistItem, WishlistPriority, WishlistStatus } from '../types';

export interface WishlistMutationPayload {
    name: string;
    description?: string | null;
    estimated_price_zmw: number;
    priority: WishlistPriority;
    category?: string | null;
    status?: WishlistStatus;
    target_date?: string | null;
    notes?: string | null;
}

export interface MarkPurchasedPayload {
    actual_price_zmw?: number | null;
    log_expense: boolean;
}

export interface UseWishlistsReturn {
    items: WishlistItem[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
    // Derived stats
    activeCount: number;
    purchasedCount: number;
    totalEstimatedValue: number;
    // Mutations
    addItem: (appId: string, payload: WishlistMutationPayload) => Promise<boolean>;
    updateItem: (id: string, payload: Partial<WishlistMutationPayload>) => Promise<boolean>;
    deleteItem: (id: string) => Promise<boolean>;
    archiveItem: (id: string) => Promise<boolean>;
    markPurchased: (item: WishlistItem, payload: MarkPurchasedPayload) => Promise<boolean>;
}

export function useWishlists(appId: string): UseWishlistsReturn {
    const { activeWorkspaceId } = useWorkspace();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchItems = useCallback(async () => {
        if (!activeWorkspaceId) return;
        setLoading(true);
        setError(null);

        const { data, error: supaErr } = await supabase
            .from('wishlists')
            .select('*')
            .eq('workspace_id', activeWorkspaceId)
            .eq('app_id', appId)
            .order('created_at', { ascending: false });

        if (supaErr) {
            setError(supaErr.message);
        } else {
            setItems((data ?? []) as WishlistItem[]);
        }
        setLoading(false);
    }, [activeWorkspaceId, appId]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // ── Derived stats ──────────────────────────────────────────────────────────
    const activeCount = items.filter(i => i.status === 'active').length;
    const purchasedCount = items.filter(i => i.status === 'purchased').length;
    const totalEstimatedValue = items
        .filter(i => i.status === 'active')
        .reduce((sum, i) => sum + Number(i.estimated_price_zmw), 0);

    // ── Mutations ──────────────────────────────────────────────────────────────

    const addItem = async (appId: string, payload: WishlistMutationPayload): Promise<boolean> => {
        if (!activeWorkspaceId) return false;
        const { error: supaErr } = await supabase.from('wishlists').insert({
            workspace_id: activeWorkspaceId,
            app_id: appId,
            ...payload,
            status: payload.status ?? 'active',
        });
        if (supaErr) { setError(supaErr.message); return false; }
        await fetchItems();
        return true;
    };

    const updateItem = async (id: string, payload: Partial<WishlistMutationPayload>): Promise<boolean> => {
        const { error: supaErr } = await supabase
            .from('wishlists')
            .update(payload)
            .eq('id', id);
        if (supaErr) { setError(supaErr.message); return false; }
        await fetchItems();
        return true;
    };

    const deleteItem = async (id: string): Promise<boolean> => {
        const { error: supaErr } = await supabase
            .from('wishlists')
            .delete()
            .eq('id', id);
        if (supaErr) { setError(supaErr.message); return false; }
        await fetchItems();
        return true;
    };

    const archiveItem = async (id: string): Promise<boolean> => {
        const { error: supaErr } = await supabase
            .from('wishlists')
            .update({ status: 'archived' })
            .eq('id', id);
        if (supaErr) { setError(supaErr.message); return false; }
        await fetchItems();
        return true;
    };

    const markPurchased = async (
        item: WishlistItem,
        { actual_price_zmw, log_expense }: MarkPurchasedPayload
    ): Promise<boolean> => {
        if (!activeWorkspaceId) return false;

        let linked_transaction_id: string | null = null;

        // Optionally log an expense transaction
        if (log_expense) {
            const amount = actual_price_zmw ?? Number(item.estimated_price_zmw);
            const { data: txData, error: txErr } = await supabase
                .from('transactions')
                .insert({
                    workspace_id: activeWorkspaceId,
                    app_id: item.app_id,
                    type: 'expense',
                    amount_zmw: amount,
                    date: new Date().toISOString().slice(0, 10),
                    description: `Wishlist: ${item.name}`,
                    metadata: {
                        category: item.category ?? 'other',
                        notes: `Purchased from wishlist`,
                    },
                })
                .select('id')
                .single();

            if (txErr) { setError(txErr.message); return false; }
            linked_transaction_id = txData?.id ?? null;
        }

        const { error: supaErr } = await supabase
            .from('wishlists')
            .update({
                status: 'purchased',
                purchase_date: new Date().toISOString().slice(0, 10),
                actual_price_zmw: actual_price_zmw ?? null,
                linked_transaction_id,
            })
            .eq('id', item.id);

        if (supaErr) { setError(supaErr.message); return false; }
        await fetchItems();
        return true;
    };

    return {
        items,
        loading,
        error,
        refetch: fetchItems,
        activeCount,
        purchasedCount,
        totalEstimatedValue,
        addItem,
        updateItem,
        deleteItem,
        archiveItem,
        markPurchased,
    };
}
