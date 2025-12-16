export interface GeneraleSetting {
    id: number;

    // Branding
    name: string | null;
    title: string | null;
    logo_id: number | null;
    favicon_id: number | null;
    app_logo_id: number | null;
    footer_logo_id: number | null;
    footer_qrcode_id: number | null;

    // Contact Info
    email: string | null;
    mobile: string | null;
    address: string | null;

    // Currency
    currency: string | null;
    currency_id: number | null;
    currency_position: 'left' | 'right' | null;

    // Theme
    primary_color: string;
    secondary_color: string;
    direction: 'ltr' | 'rtl' | null;

    // Business Settings
    business_based_on: 'commission' | 'subscription';
    commission: number;
    commission_type: 'percentage' | 'fixed';
    commission_charge: 'per_order' | 'per_product';
    shop_type: 'multi' | 'single';
    shop_pos: boolean;
    shop_register: boolean;
    new_product_approval: boolean;
    update_product_approval: boolean;

    // Payment & Delivery
    cash_on_delivery: boolean;
    online_payment: boolean;
    default_delivery_charge: number;
    return_order_within_days: number;

    // Withdraw
    min_withdraw: number | null;
    max_withdraw: number | null;
    withdraw_request: number | null;

    // Footer
    show_footer: boolean;
    footer_phone: string | null;
    footer_email: string | null;
    footer_text: string | null;
    footer_description: string | null;

    // App Download
    show_download_app: boolean;
    google_playstore_url: string | null;
    app_store_url: string | null;

    // Display Options
    show_sku: boolean;

    // AI Prompts
    product_description: string | null;
    page_description: string | null;
    blog_description: string | null;

    // Computed Attributes
    logo: string;
    app_logo: string;
    favicon: string;
    footer_logo: string;
    footer_qr: string | null;

    // Timestamps
    created_at: string;
    updated_at: string;
}

export interface Currency {
    id: number;
    name: string;
    code: string;
    symbol: string;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface GeneralSettingsResponse {
    success: boolean;
    data: {
        setting: GeneraleSetting;
        currencies: Currency[];
    };
    message: string;
}

export interface ThemeSettingsResponse {
    success: boolean;
    data: {
        primary_color: string;
        secondary_color: string;
        direction: 'ltr' | 'rtl';
    };
}

export interface BusinessSettingsResponse {
    success: boolean;
    data: {
        business_based_on: 'commission' | 'subscription';
        commission: number;
        commission_type: 'percentage' | 'fixed';
        commission_charge: 'per_order' | 'per_product';
        shop_type: 'multi' | 'single';
        shop_pos: boolean;
        shop_register: boolean;
        new_product_approval: boolean;
        update_product_approval: boolean;
        cash_on_delivery: boolean;
        online_payment: boolean;
        default_delivery_charge: number;
        return_order_within_days: number;
        min_withdraw: number;
        max_withdraw: number;
        withdraw_request: number;
    };
}

export interface WithdrawSettingsResponse {
    success: boolean;
    data: {
        min_withdraw: number;
        max_withdraw: number;
        withdraw_request: number;
    };
}

export interface AIPromptsResponse {
    success: boolean;
    data: {
        product_description: string;
        page_description: string;
        blog_description: string;
    };
}

export interface AIConfigResponse {
    success: boolean;
    data: {
        api_key_configured: boolean;
        organization_configured: boolean;
    };
}
