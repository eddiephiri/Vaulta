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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm sm:p-6">
            <div className="w-full max-w-3xl overflow-hidden shadow-2xl bg-white rounded-2xl ring-1 ring-slate-900/10 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Parse Cashing SMS</h2>
                        <p className="text-sm text-slate-500">Paste SMS notifications to record cashings</p>
                    </div>
                    <button onClick={onClose} className="p-2 transition-colors rounded-full text-slate-400 hover:text-slate-500 hover:bg-slate-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Vehicle</label>
                                <select
                                    value={selectedVehicleId}
                                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                                    className="w-full h-11 px-3 text-sm bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select a vehicle...</option>
                                    {activeVehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Paste SMS Messages</label>
                                <textarea
                                    value={smsText}
                                    onChange={(e) => setSmsText(e.target.value)}
                                    placeholder="Paste one or more transaction SMS messages here..."
                                    className="w-full h-48 p-4 text-sm bg-white border rounded-xl border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <h3 className="text-md font-medium text-slate-900">Review Parsed Data</h3>
                            {parsedResults.map((res, i) => (
                                <div key={i} className="p-4 border border-slate-200 rounded-xl space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500">Amount (ZMW)</label>
                                            <input type="text" readOnly value={res.amount || ''} className="w-full mt-1 bg-slate-50 border-none rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500">Date</label>
                                            <input type="text" readOnly value={res.date || ''} className="w-full mt-1 bg-slate-50 border-none rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500">Sender</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <input type="text" readOnly value={res.sender || ''} className="flex-1 bg-slate-50 border-none rounded-lg text-sm" />
                                                {res.isValidSender ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                ) : (
                                                    <AlertCircle className="w-4 h-4 text-amber-500" />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500">Transaction ID</label>
                                            <input type="text" readOnly value={res.transactionId || ''} className="w-full mt-1 bg-slate-50 border-none rounded-lg text-sm" />
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4 border-t border-slate-100">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Apply to Cashing</label>
                                        <select
                                            value={selections[i] || ''}
                                            onChange={(e) => setSelections({ ...selections, [i]: e.target.value })}
                                            className="w-full h-10 px-3 text-sm bg-white border rounded-lg border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
                    <button
                        onClick={() => step === 2 ? setStep(1) : onClose()}
                        className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                        {step === 2 ? 'Back' : 'Cancel'}
                    </button>
                    {step === 1 ? (
                        <button
                            onClick={handleParse}
                            disabled={!selectedVehicleId || !smsText.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition-colors bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            Parse Messages
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white transition-colors bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Confirm & Save'}
                            {!saving && <Check className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
