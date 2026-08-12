import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { OdometerReading } from '../types';

/** Returns the current ISO week label, e.g. '2026-W32' */
function getCurrentISOWeek(): string {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

interface UseDriverOdometerReturn {
    readings: OdometerReading[];
    submittedThisWeek: boolean;
    thisWeekReading: OdometerReading | null;
    loading: boolean;
    error: string | null;
    submitting: boolean;
    submitError: string | null;
    submit: (readingKm: number, photoUrl?: string | null, notes?: string | null) => Promise<boolean>;
    uploadPhoto: (file: File, workspaceId: string, driverId: string) => Promise<string | null>;
    refetch: () => void;
}

export function useDriverOdometer(driverId: string | undefined): UseDriverOdometerReturn {
    const [readings, setReadings] = useState<OdometerReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const currentWeek = getCurrentISOWeek();

    const fetchReadings = useCallback(async () => {
        if (!driverId) { setLoading(false); return; }
        setLoading(true);
        setError(null);

        const { data, error: err } = await supabase
            .from('odometer_readings')
            .select('*')
            .eq('driver_id', driverId)
            .order('submitted_at', { ascending: false })
            .limit(10);

        if (err) setError(err.message);
        else setReadings((data ?? []) as OdometerReading[]);
        setLoading(false);
    }, [driverId]);

    useEffect(() => { fetchReadings(); }, [fetchReadings]);

    const thisWeekReading = readings.find(r => r.iso_week === currentWeek) ?? null;
    const submittedThisWeek = thisWeekReading !== null;

    /** Upload an odometer photo to Supabase Storage. Returns the public signed URL. */
    const uploadPhoto = async (
        file: File,
        workspaceId: string,
        driverId: string
    ): Promise<string | null> => {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${workspaceId}/${driverId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
            .from('odometer-photos')
            .upload(path, file, { upsert: true });

        if (uploadErr) {
            setSubmitError(`Photo upload failed: ${uploadErr.message}`);
            return null;
        }

        const { data } = supabase.storage
            .from('odometer-photos')
            .getPublicUrl(path);

        return data?.publicUrl ?? null;
    };

    const submit = async (
        readingKm: number,
        photoUrl?: string | null,
        notes?: string | null
    ): Promise<boolean> => {
        setSubmitting(true);
        setSubmitError(null);

        const { error: rpcErr } = await supabase.rpc('driver_submit_odometer', {
            p_reading_km: readingKm,
            p_photo_url:  photoUrl ?? null,
            p_notes:      notes ?? null,
        });

        setSubmitting(false);

        if (rpcErr) {
            setSubmitError(rpcErr.message);
            return false;
        }

        await fetchReadings();
        return true;
    };

    return {
        readings,
        submittedThisWeek,
        thisWeekReading,
        loading,
        error,
        submitting,
        submitError,
        submit,
        uploadPhoto,
        refetch: fetchReadings,
    };
}
