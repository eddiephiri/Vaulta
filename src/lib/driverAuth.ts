// Drivers sign in with phone + password, but Supabase's phone provider requires
// a paid SMS provider. We avoid that by mapping the phone to a deterministic
// synthetic email and using email+password auth under the hood. The driver only
// ever sees their phone number.
//
// These helpers MUST stay identical to the copies in the provision-driver edge
// function (supabase/functions/provision-driver/index.ts), or provisioning and
// login will disagree on the email and sign-in will fail.

const DRIVER_EMAIL_DOMAIN = 'drivers.vaulta.app';

/** Normalize a phone number to E.164, defaulting to Zambia (+260) for local formats. */
export function normalizeDriverPhone(raw: string): string {
    let p = (raw || '').replace(/[\s\-()]/g, '');
    if (p.startsWith('+')) {
        // already international
    } else if (p.startsWith('00')) {
        p = '+' + p.slice(2);
    } else if (p.startsWith('0')) {
        p = '+260' + p.slice(1);
    } else if (p.startsWith('260')) {
        p = '+' + p;
    } else {
        p = '+260' + p;
    }
    if (!/^\+\d{10,15}$/.test(p)) {
        throw new Error('Enter a valid phone number, e.g. +260977000000 or 0977000000.');
    }
    return p;
}

/** Map an E.164 (or local) phone to the deterministic synthetic login email. */
export function phoneToDriverEmail(phone: string): string {
    const e164 = normalizeDriverPhone(phone);
    return `${e164.replace(/\D/g, '')}@${DRIVER_EMAIL_DOMAIN}`;
}
