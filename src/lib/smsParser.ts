export interface ParsedSms {
    originalText: string;
    amount: number | null;
    sender: string | null;
    transactionId: string | null;
    date: string | null;
    provider: 'airtel' | 'mtn' | 'yango' | 'unknown';
    isValidSender?: boolean;
}

/**
 * Tries to parse the provided text as one or more SMS messages.
 * Splits on common boundaries (like multiple newlines) and processes each segment.
 */
export function parseSmsMessages(text: string): ParsedSms[] {
    // Split by multiple newlines or simple newline if it seems to separate distinct messages
    // Or just treat the whole block as one if they don't use newlines.
    // A robust way is to find patterns that look like the start of a message.
    
    // For now, let's split by double newlines as a safe fallback, or single newline if it separates "You have received..."
    // Let's normalize newlines first.
    const normalized = text.replace(/\r\n/g, '\n');
    
    // Split by looking for "You have received" or similar start tokens, but a simple newline split is a good start.
    // If users paste separated by space, that's harder without a specific boundary. 
    // Let's just try to extract all matches of our regexes from the entire text.
    
    const results: ParsedSms[] = [];
    
    // --- Airtel Pattern ---
    // Example: You have received ZMW 3500.00 from 977207242 Saidi Phiri.Dial *115# to check your new Bal. TID: PP260817.1950.D63819.
    // The "ZMW " could be "ZMW" or "ZMW ".
    // Sender is between "from " and ".Dial" or just before a period.
    const airtelRegex = /You have received ZMW\s*([\d,.]+)\s*from\s*([^.]+)\.Dial.*TID:\s*([A-Z0-9.]+)/gi;
    
    let match;
    while ((match = airtelRegex.exec(normalized)) !== null) {
        const fullMatch = match[0];
        const amountStr = match[1].replace(/,/g, '');
        const sender = match[2].trim();
        const tid = match[3].trim();
        
        let date = null;
        // Try to parse date from Airtel TID: PP260817 -> 2026-08-17
        const dateMatch = tid.match(/^PP(\d{2})(\d{2})(\d{2})\./);
        if (dateMatch) {
            const yy = dateMatch[1];
            const mm = dateMatch[2];
            const dd = dateMatch[3];
            date = `20${yy}-${mm}-${dd}`;
        }
        
        results.push({
            originalText: fullMatch,
            amount: parseFloat(amountStr) || null,
            sender: sender,
            transactionId: tid,
            date: date,
            provider: 'airtel'
        });
    }

    // Add other providers here later (MTN, Yango, etc.)

    return results;
}
