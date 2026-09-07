import { useState, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, ChevronRight, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { parseSmsMessages } from '../lib/smsParser';
import type { ParsedSms } from '../lib/smsParser';
import type { Vehicle, ExpectedCashing, Driver } from '../types';

interface ParseCashingSmsModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicles: Vehicle[];
    drivers: Driver[];
    cashings: ExpectedCashing[];
    onSuccess: () => void;
}

const INPUT_STYLE = {
    background: 'var(--ff-surface)',
    color: 'var(--ff-text-primary)',
    border: '1px solid var(--ff-border)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 14,
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
} as const;

const LABEL_STYLE = {
    display: 'block',
    fontSize: 12,
    color: 'var(--ff-text-muted)',
    marginBottom: 4,
} as const;

export function ParseCashingSmsModal({
    isOpen,
    onClose,
    vehicles,
    drivers,
    cashings,
    onSuccess
}: ParseCashingSmsModalProps) {
    const { activeWorkspaceId } = useWorkspace();
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
    const [smsText, setSmsText] = useState('');
    const [parsedResults, setParsedResults] = useState<ParsedSms[]>([]);
    const [step, setStep] = useState<1 | 2>(1); // 1: Input, 2: Review
    const [saving, setSaving] = useState(false);

    const activeVehicles = vehicles.filter(v => v.status === 'active');
    
    const selectedVehicle = useMemo(
        () => vehicles.find(v => v.id === selectedVehicleId),
        [vehicles, selectedVehicleId]
    );

    const vehicleDriver = useMemo(() => {
        if (!selectedVehicleId) return null;
        return drivers.find(d => d.vehicle_id === selectedVehicleId && d.active);
    }, [drivers, selectedVehicleId]);

    // Pending cashings for the selected vehicle
    const pendingCashings = useMemo(() => {
        return cashings
            .filter(c => c.vehicle_id === selectedVehicleId && (c.status === 'pending' || c.status === 'deferred_to_salary'))
            .sort((a, b) => a.expected_date.localeCompare(b.expected_date));
    }, [cashings, selectedVehicleId]);

    const [selections, setSelections] = useState<Record<number, string>>({});

    const handleParse = () => {
        const results = parseSmsMessages(smsText);
        
        // Validate senders
        const validated = results.map(res => {
            let isValid = false;
            // Simplified validation: if Yango, check against driver name.
            // If other, check against vehicle's valid_sms_senders (if implemented).
            if (res.sender) {
                const s = res.sender.toLowerCase();
                if (selectedVehicle?.valid_sms_senders?.some(vs => s.includes(vs.toLowerCase()))) {
                    isValid = true;
                } else if (vehicleDriver?.name && s.includes(vehicleDriver.name.toLowerCase())) {
                    isValid = true; // Yango driver match
                }
            }
            return { ...res, isValidSender: isValid };
        });

        setParsedResults(validated);
        
        // Auto-select pending cashings (oldest first)
        const initialSelections: Record<number, string> = {};
        validated.forEach((_, i) => {
            if (pendingCashings[i]) {
                initialSelections[i] = pendingCashings[i].id;
            }
        });
        setSelections(initialSelections);
        
        setStep(2);
    };

    const handleSave = async () => {
        if (!selectedVehicleId) return;
        setSaving(true);
        
        try {
            // Process each selected cashing mapping
            for (let i = 0; i < parsedResults.length; i++) {
                const cashingId = selections[i];
                if (!cashingId) continue; // Skip if user didn't map this SMS

                const res = parsedResults[i];
                if (!res.amount) continue;

                // 1. Insert into transactions
                const payload = {
                    workspace_id: activeWorkspaceId,
                    app_id: 'transport',
                    type: 'income',
                    reference_entity_id: selectedVehicleId,
                    date: res.date || new Date().toISOString().slice(0, 10),
                    amount_zmw: res.amount,
                    description: 'Recorded via SMS parser',
                    metadata: {
                        source: res.provider === 'airtel' || res.provider === 'mtn' ? 'other' : 'yango',
                        expected_cashing_id: cashingId,
                        reference: res.transactionId || null,
                        sender: res.sender || null,
                    }
                };

                const { data: txData, error: txError } = await supabase
                    .from('transactions')
                    .insert(payload)
                    .select('id')
                    .single();

                if (txError) throw txError;

                // 2. Update expected cashing
                if (txData?.id) {
                    const { error: ecError } = await supabase
                        .from('expected_cashings')
                        .update({ status: 'recorded', transaction_id: txData.id })
                        .eq('id', cashingId);
                    
                    if (ecError) throw ecError;
                }
            }
            
            onSuccess();
            onClose();
            // Reset state for next time
            setSmsText('');
            setParsedResults([]);
            setStep(1);
            setSelections({});
        } catch (err: any) {
            alert('Error saving data: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: 'var(--ff-surface)',
                border: '1px solid var(--ff-border)',
                borderRadius: 16,
                width: '100%',
                maxWidth: 'min(700px, 95vw)',
                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column',
                maxHeight: '90vh',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--ff-border)' }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ff-text-primary)' }}>Parse Cashing SMS</h2>
                        <p style={{ fontSize: 13, color: 'var(--ff-text-muted)', marginTop: 4 }}>Paste SMS notifications to record cashings</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ff-text-muted)', padding: 4, cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {step === 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <label style={LABEL_STYLE}>Vehicle *</label>
                                <select
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    style={INPUT_STYLE}
                                >
                                    <option value="">Select a vehicle...</option>
                                    {activeVehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={LABEL_STYLE}>Paste SMS Messages *</label>
                                <textarea
                                    value={smsText}
                                    onChange={(e) => setSmsText(e.target.value)}
                                    placeholder="Paste one or more transaction SMS messages here..."
                                    style={{ ...INPUT_STYLE, height: 160, resize: 'vertical' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ff-text-primary)' }}>Review Parsed Data</h3>
                            {parsedResults.map((res, i) => (
                                <div key={i} style={{ padding: 16, border: '1px solid var(--ff-border)', borderRadius: 12 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                        <div>
                                            <label style={LABEL_STYLE}>Amount (ZMW)</label>
                                            <input type="text" readOnly value={res.amount || ''} style={{ ...INPUT_STYLE, background: 'var(--ff-bg)' }} />
                                        </div>
                                        <div>
                                            <label style={LABEL_STYLE}>Date</label>
                                            <input type="text" readOnly value={res.date || ''} style={{ ...INPUT_STYLE, background: 'var(--ff-bg)' }} />
                                        </div>
                                        <div>
                                            <label style={LABEL_STYLE}>Sender</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input type="text" readOnly value={res.sender || ''} style={{ ...INPUT_STYLE, background: 'var(--ff-bg)' }} />
                                                {res.isValidSender ? (
                                                    <CheckCircle2 size={18} color="#22c55e" />
                                                ) : (
                                                    <AlertCircle size={18} color="#f59e0b" />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label style={LABEL_STYLE}>Transaction ID</label>
                                            <input type="text" readOnly value={res.transactionId || ''} style={{ ...INPUT_STYLE, background: 'var(--ff-bg)' }} />
                                        </div>
                                    </div>
                                    
                                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--ff-border)' }}>
                                        <label style={LABEL_STYLE}>Apply to Cashing</label>
                                        <select
                                            value={selections[i] || ''}
                                            onChange={(e) => setSelections({ ...selections, [i]: e.target.value })}
                                            style={INPUT_STYLE}
                                        >
                                            <option value="">Do not apply / Skip</option>
                                            {pendingCashings.map(c => (
                                                <option key={c.id} value={c.id}>
                                                    Expected: {c.expected_date} (Week {c.week_number})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '16px 24px', borderTop: '1px solid var(--ff-border)' }}>
                    <button
                        onClick={() => step === 2 ? setStep(1) : onClose()}
                        style={{
                            padding: '8px 16px', borderRadius: 8, fontSize: 14,
                            background: 'var(--ff-surface)', color: 'var(--ff-text-muted)',
                            border: '1px solid var(--ff-border)', cursor: 'pointer'
                        }}
                    >
                        {step === 2 ? 'Back' : 'Cancel'}
                    </button>
                    {step === 1 ? (
                        <button
                            onClick={handleParse}
                            disabled={!selectedVehicleId || !smsText.trim()}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8, fontSize: 14,
                                fontWeight: 600, background: (!selectedVehicleId || !smsText.trim()) ? '#334155' : 'var(--ff-accent)',
                                color: 'white', border: 'none', cursor: (!selectedVehicleId || !smsText.trim()) ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Parse Messages
                            <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8, fontSize: 14,
                                fontWeight: 600, background: saving ? '#334155' : 'var(--ff-accent)',
                                color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {saving ? 'Saving...' : 'Confirm & Save'}
                            {!saving && <Check size={16} />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
