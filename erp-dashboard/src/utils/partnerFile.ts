/**
 * .partner File Format — Parser, Serializer & Field Mapping
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * File format
 * ───────────
 * Lines beginning with `#` are comments (ignored by the parser).
 * Empty lines are skipped.
 * Data lines follow the pattern:
 *
 *     fieldName__:value;
 *
 * The `__:` separator and the trailing `;` are the canonical delimiters.
 * The parser also accepts `fieldName:value` (without `__`) and `value` without
 * a trailing `;` as graceful fallbacks so that hand-written files still work.
 *
 * Section prefixes
 * ────────────────
 * auth.*         → user account fields (only used in create mode)
 * cf.* / custom.* → custom entity fields
 * (no prefix)    → partner profile fields
 *
 * Field aliases
 * ─────────────
 * Keys are looked up in FIELD_ALIASES first so that French / English / short-
 * hand names all resolve to the same canonical form field key.
 *
 * Example file
 * ────────────
 * # Partner Import File
 * # Version: 1.0
 * # Generated: 2026-02-21
 *
 * name__:Supermarché Atlas;
 * phone__:+212600000001;
 * email__:atlas@example.ma;
 * city__:Casablanca;
 * region__:Casablanca-Settat;
 * country__:MA;
 * credit_limit__:50000;
 * payment_term_id__:2;
 *
 * auth.name__:Mohamed;
 * auth.last_name__:Atlas;
 * auth.email__:admin@atlas.ma;
 *
 * cf.partner_rib__:MA0123456789012345678;
 */

// ─── Field aliases ────────────────────────────────────────────────────────────

/**
 * Maps every canonical form field name to a list of accepted input aliases
 * (lower-cased, spaces normalised to underscores).
 *
 * When the parser sees an unknown key it normalises it and performs a reverse
 * lookup through this table to find the canonical name.
 */
const FIELD_ALIASES: Record<string, string[]> = {
    // ── Identity ──────────────────────────────────────────────────────────────
    name:                  ['name', 'partner_name', 'company_name', 'raison_sociale',
                            'nom_entreprise', 'société', 'societe', 'nom'],
    code:                  ['code', 'partner_code', 'code_client', 'code_partenaire',
                            'numero_client'],
    partner_type:          ['partner_type', 'type', 'type_partenaire'],
    channel:               ['channel', 'canal', 'distribution_channel'],
    status:                ['status', 'statut', 'etat'],

    // ── Contact ───────────────────────────────────────────────────────────────
    phone:                 ['phone', 'tel', 'telephone', 'téléphone', 'mobile',
                            'gsm', 'portable', 'fixe'],
    email:                 ['email', 'e_mail', 'courriel', 'mail'],
    whatsapp:              ['whatsapp', 'wa', 'ws'],
    website:               ['website', 'site_web', 'url', 'site'],

    // ── Address ───────────────────────────────────────────────────────────────
    address_line1:         ['address_line1', 'address', 'adresse', 'adresse1',
                            'adresse_ligne1', 'rue', 'street'],
    address_line2:         ['address_line2', 'adresse2', 'adresse_ligne2',
                            'complement_adresse'],
    city:                  ['city', 'ville', 'cité', 'cite'],
    region:                ['region', 'région', 'province'],
    country:               ['country', 'pays', 'country_code', 'code_pays'],
    postal_code:           ['postal_code', 'code_postal', 'zip', 'cp'],
    geo_area_code:         ['geo_area_code', 'zone_geo', 'geo_area', 'zone'],

    // ── Commercial ────────────────────────────────────────────────────────────
    price_list_id:         ['price_list_id', 'price_list', 'liste_prix',
                            'tarif', 'liste_tarif'],
    payment_term_id:       ['payment_term_id', 'payment_term', 'condition_paiement',
                            'modalite_paiement', 'delai_paiement'],
    credit_limit:          ['credit_limit', 'limite_credit', 'plafond_credit',
                            'encours', 'credit'],
    default_discount_rate: ['default_discount_rate', 'discount', 'discount_rate',
                            'remise', 'taux_remise', 'remise_defaut'],
    max_discount_rate:     ['max_discount_rate', 'remise_max', 'remise_maximum'],

    // ── Tax ───────────────────────────────────────────────────────────────────
    tax_number_ice:        ['tax_number_ice', 'ice', 'identifiant_commun'],
    tax_number_if:         ['tax_number_if', 'if', 'identifiant_fiscal'],
    tax_exempt:            ['tax_exempt', 'exonere_tva', 'exonere', 'exonération'],

    // ── Delivery ──────────────────────────────────────────────────────────────
    delivery_instructions: ['delivery_instructions', 'instructions_livraison',
                            'notes_livraison', 'consignes'],
    delivery_zone:         ['delivery_zone', 'zone_livraison', 'secteur_livraison'],
    min_order_amount:      ['min_order_amount', 'montant_minimum', 'commande_min',
                            'min_commande'],
    opening_hours:         ['opening_hours', 'horaires', 'heures_ouverture'],

    // ── Commercial extras ─────────────────────────────────────────────────────
    currency:              ['currency', 'devise', 'monnaie'],
    default_discount_amount: ['default_discount_amount', 'remise_fixe',
                              'discount_amount', 'montant_remise'],
    max_discount_rate:     ['max_discount_rate', 'remise_max', 'remise_maximum'],
    risk_score:            ['risk_score', 'score_risque', 'risque'],
    salesperson_id:        ['salesperson_id', 'commercial_id', 'vendeur_id'],
    parent_partner_id:     ['parent_partner_id', 'parent_id', 'groupe_id'],

    // ── Tax extras ────────────────────────────────────────────────────────────
    vat_group_code:        ['vat_group_code', 'groupe_tva', 'code_tva'],

    // ── Address extras ────────────────────────────────────────────────────────
    geo_lat:               ['geo_lat', 'latitude', 'lat'],
    geo_lng:               ['geo_lng', 'longitude', 'lng', 'lon'],

    // ── Options ───────────────────────────────────────────────────────────────
    allow_show_on_pos:     ['allow_show_on_pos', 'visible_pos', 'afficher_pos'],
    blocked_until:         ['blocked_until', 'bloquer_jusqu', 'date_deblocage'],
    block_reason:          ['block_reason', 'motif_blocage', 'raison_blocage'],

    // ── Auth (user account) ───────────────────────────────────────────────────
    'auth.name':           ['auth.name', 'auth_name', 'firstname', 'prenom',
                            'prénom'],
    'auth.last_name':      ['auth.last_name', 'auth_last_name', 'lastname',
                            'nom_famille', 'nom_utilisateur'],
    'auth.email':          ['auth.email', 'auth_email', 'login_email',
                            'email_compte'],
    'auth.phone':          ['auth.phone', 'auth_phone', 'phone_compte'],
    'auth.password':       ['auth.password', 'auth_password', 'mot_de_passe',
                            'password', 'mdp'],
    'auth.gender':         ['auth.gender', 'auth_gender', 'genre', 'sexe'],
    'auth.branch_code':    ['auth.branch_code', 'auth_branch', 'agence',
                            'branch', 'code_agence'],
    'auth.geo_area_code':  ['auth.geo_area_code', 'auth_geo', 'zone_compte'],
    'auth.target_app':     ['auth.target_app', 'target_app', 'application'],
    'auth.is_active':      ['auth.is_active', 'is_active', 'actif', 'active'],
};

/** Reverse alias lookup:  normalised alias → canonical key */
const ALIAS_TO_FIELD: Map<string, string> = new Map();
for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
        ALIAS_TO_FIELD.set(normalizeKey(alias), canonical);
    }
}

function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[\s\-]/g, '_');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldSection = 'partner' | 'auth' | 'custom';

export interface ParsedField {
    /** Original key as written in the file */
    rawKey:       string;
    /** Resolved canonical form-field key (e.g. "city", "auth.name") */
    canonicalKey: string;
    /** Human-readable label for the preview table */
    displayLabel: string;
    /** Raw string value from the file */
    value:        string;
    section:      FieldSection;
    /** True if the key resolved to a known form field */
    recognized:   boolean;
}

export interface PartnerFileMetadata {
    version?:     string;
    generatedAt?: string;
    source?:      string;
}

export interface ParseResult {
    ok:       boolean;
    fields:   ParsedField[];
    errors:   string[];
    warnings: string[];
    metadata: PartnerFileMetadata;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

const KNOWN_CANONICAL = new Set(Object.keys(FIELD_ALIASES));

/**
 * Parse a `.partner` file string into structured field data.
 *
 * Accepted line formats:
 *   fieldName__:value;   ← canonical
 *   fieldName:value;     ← no double-underscore (still accepted)
 *   fieldName__:value    ← no trailing semicolon (still accepted)
 */
export function parsePartnerFile(content: string): ParseResult {
    const fields:   ParsedField[]        = [];
    const errors:   string[]             = [];
    const warnings: string[]             = [];
    const metadata: PartnerFileMetadata  = {};

    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const lineNo = i + 1;
        const raw    = lines[i].trim();

        if (!raw) continue;

        // Comment / metadata line
        if (raw.startsWith('#')) {
            const comment = raw.slice(1).trim();
            const lc = comment.toLowerCase();
            if (lc.startsWith('version:'))     metadata.version     = comment.split(':')[1]?.trim();
            if (lc.startsWith('generated:'))   metadata.generatedAt = comment.split(':').slice(1).join(':').trim();
            if (lc.startsWith('source:'))      metadata.source      = comment.split(':').slice(1).join(':').trim();
            continue;
        }

        // Parse   key__:value;   or   key:value;
        //  Group 1: key (anything before __ or :)
        //  Group 2: value (anything between : and optional ;)
        const match = raw.match(/^([^\s:]+?)(?:__)?:(.*?);?\s*$/);
        if (!match) {
            errors.push(`Ligne ${lineNo}: format invalide — « ${raw.slice(0, 60)} »`);
            continue;
        }

        const rawKey   = match[1].trim();
        const rawValue = match[2].trim();

        if (!rawValue) {
            warnings.push(`Ligne ${lineNo}: « ${rawKey} » ignoré (valeur vide)`);
            continue;
        }

        // Determine section from key prefix
        let section: FieldSection = 'partner';
        let lookupKey = rawKey;

        if (rawKey.startsWith('auth.') || rawKey.startsWith('auth_')) {
            section   = 'auth';
        } else if (
            rawKey.startsWith('cf.')      ||
            rawKey.startsWith('custom.')  ||
            rawKey.startsWith('custom_field.')
        ) {
            section   = 'custom';
            lookupKey = rawKey.replace(/^(cf\.|custom\.|custom_field\.)/, '');
        }

        // Resolve canonical key
        const normalised = normalizeKey(lookupKey);
        const canonical  = ALIAS_TO_FIELD.get(normalised) ?? lookupKey;
        const recognized = KNOWN_CANONICAL.has(canonical);

        if (!recognized && section === 'partner') {
            // Could still be a valid custom field
            section = 'custom';
        }

        fields.push({
            rawKey,
            canonicalKey: canonical,
            displayLabel: toDisplayLabel(canonical),
            value:        rawValue,
            section,
            recognized,
        });
    }

    return {
        ok:     errors.length === 0,
        fields,
        errors,
        warnings,
        metadata,
    };
}

function toDisplayLabel(key: string): string {
    return key
        .replace('auth.', 'Compte — ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Applicator ───────────────────────────────────────────────────────────────

export type AppliedResult = {
    partner:      Record<string, unknown>;
    auth:         Record<string, unknown>;
    customFields: Record<string, string>;
};

/**
 * Convert selected parsed fields into form-compatible objects.
 * Only fields whose `rawKey` is present in `selectedKeys` are applied.
 */
export function applyParsedFields(
    fields:       ParsedField[],
    selectedKeys: Set<string>,
): AppliedResult {
    const partner:      Record<string, unknown> = {};
    const auth:         Record<string, unknown> = {};
    const customFields: Record<string, string>  = {};

    const NUMERIC_FIELDS = new Set([
        'credit_limit', 'price_list_id', 'payment_term_id',
        'default_discount_rate', 'default_discount_amount', 'max_discount_rate',
        'min_order_amount', 'risk_score', 'salesperson_id', 'parent_partner_id',
        'geo_lat', 'geo_lng',
    ]);
    const BOOL_FIELDS = new Set(['tax_exempt', 'allow_show_on_pos', 'auth.is_active']);

    for (const field of fields) {
        if (!selectedKeys.has(field.rawKey)) continue;

        let value: unknown = field.value;

        // Type coercions
        if (NUMERIC_FIELDS.has(field.canonicalKey)) {
            value = parseFloat(field.value) || 0;
        } else if (BOOL_FIELDS.has(field.canonicalKey)) {
            value = ['true', '1', 'oui', 'yes'].includes(field.value.toLowerCase());
        }

        if (field.section === 'auth') {
            const key = field.canonicalKey.replace(/^auth\./, '');
            auth[key]  = value;
        } else if (field.section === 'custom') {
            const key  = field.canonicalKey.replace(/^(cf\.|custom\.|custom_field\.)/, '');
            customFields[key] = String(value);
        } else {
            partner[field.canonicalKey] = value;
        }
    }

    return { partner, auth, customFields };
}

// ─── Serializer ───────────────────────────────────────────────────────────────

/**
 * Serialize current form state to a `.partner` file string.
 * Only non-empty / non-zero / non-default values are emitted.
 */
export function serializeToPartnerFile(
    pForm:   Record<string, unknown>,
    auth:    Record<string, unknown>,
    cfForm:  Record<string, string>,
): string {
    const date = new Date().toISOString().split('T')[0];
    const lines: string[] = [
        '# Partner Import File',
        '# Version: 1.0',
        `# Generated: ${date}`,
        '# Source: ERP Dashboard',
        '',
    ];

    function emit(section: string, entries: [string, unknown][]): void {
        const rows = entries.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 0 && v !== false);
        if (rows.length === 0) return;
        lines.push(`# ── ${section} ${'─'.repeat(Math.max(0, 52 - section.length))}`);
        for (const [k, v] of rows) {
            lines.push(`${k}__:${v};`);
        }
        lines.push('');
    }

    emit('Identité', [
        ['name', pForm.name], ['code', pForm.code],
        ['partner_type', pForm.partner_type], ['channel', pForm.channel],
        ['status', pForm.status],
    ]);

    emit('Contact', [
        ['phone', pForm.phone], ['email', pForm.email],
        ['whatsapp', pForm.whatsapp], ['website', pForm.website],
    ]);

    emit('Adresse', [
        ['address_line1', pForm.address_line1], ['address_line2', pForm.address_line2],
        ['city', pForm.city], ['region', pForm.region],
        ['country', pForm.country], ['postal_code', pForm.postal_code],
        ['geo_area_code', pForm.geo_area_code],
    ]);

    emit('Commercial', [
        ['price_list_id', pForm.price_list_id],
        ['payment_term_id', pForm.payment_term_id],
        ['credit_limit', pForm.credit_limit],
        ['default_discount_rate', pForm.default_discount_rate],
    ]);

    emit('Fiscal', [
        ['tax_number_ice', pForm.tax_number_ice],
        ['tax_number_if', pForm.tax_number_if],
        ['tax_exempt', pForm.tax_exempt],
    ]);

    emit('Livraison', [
        ['delivery_zone', pForm.delivery_zone],
        ['delivery_instructions', pForm.delivery_instructions],
        ['min_order_amount', pForm.min_order_amount],
    ]);

    // Auth section
    const authEntries: [string, unknown][] = Object.entries(auth)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [`auth.${k}`, v]);
    emit('Compte utilisateur', authEntries);

    // Custom fields
    const cfEntries: [string, unknown][] = Object.entries(cfForm)
        .filter(([, v]) => v)
        .map(([k, v]) => [`cf.${k}`, v]);
    emit('Champs personnalisés', cfEntries);

    return lines.join('\n');
}

// ─── File helpers ─────────────────────────────────────────────────────────────

export const PARTNER_FILE_EXTENSION = '.partner';
export const PARTNER_FILE_MIME      = 'application/x-partner';

/** Trigger browser download of a `.partner` file */
export function downloadPartnerFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename.endsWith(PARTNER_FILE_EXTENSION) ? filename : `${filename}${PARTNER_FILE_EXTENSION}`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Read a File object to a string (async) */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = e => resolve(e.target?.result as string ?? '');
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, 'utf-8');
    });
}

/** Return true if the File looks like a .partner file */
export function isPartnerFile(file: File): boolean {
    return file.name.endsWith(PARTNER_FILE_EXTENSION) || file.type === PARTNER_FILE_MIME;
}
