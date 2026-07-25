import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getDefaultRoute } from '@/lib/rbac/defaultRoute';
import { Loader2, Lock, Mail, Eye, EyeOff, Shield, BarChart3, Globe2, Boxes, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Read a CSS HSL variable from :root ──────────────────────────────────────
function readHslVar(varName: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return val ? `hsl(${val})` : fallback;
}

/** Extract just the hue number from a CSS HSL variable (e.g. "158 100% 34%" → 158) */
function readHue(varName: string, fallback: number): number {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    if (!val) return fallback;
    const hue = parseFloat(val.split(' ')[0]);
    return isNaN(hue) ? fallback : hue;
}

// ─── Reactive theme colors hook (mirrors DataGrid pattern) ───────────────────
function useLoginTheme() {
    const read = () => {
        const hue = readHue('--sage-500', 158);
        // Panel background: very dark tinted shades derived from brand hue
        return {
            primary:    readHslVar('--sage-600', 'hsl(158 100% 27%)'),
            primaryDk:  readHslVar('--sage-700', 'hsl(158 100% 22%)'),
            accent:     readHslVar('--sage-500', 'hsl(158 100% 34%)'),
            light:      readHslVar('--sage-50',  'hsl(152 76% 97%)'),
            // Deep dark panel shades – same hue as brand, very low lightness
            panelFrom:  `hsl(${hue} 55% 8%)`,
            panelMid:   `hsl(${hue} 50% 12%)`,
            panelTo:    `hsl(${hue} 48% 16%)`,
        };
    };

    const [colors, setColors] = useState(read);

    useEffect(() => {
        const mo = new MutationObserver(() => setColors(read()));
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
        return () => mo.disconnect();
    }, []);

    return colors;
}

export const Login = () => {
    const { t } = useTranslation();
    const { register, handleSubmit, formState: { errors } } = useForm();
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const theme = useLoginTheme();
    // Only present when ProtectedRoute bounced the user here from a specific page —
    // in that case always honor it over any role-based landing route below.
    const explicitFrom = (location.state as any)?.from?.pathname as string | undefined;

    const onSubmit = async (data: any) => {
        setIsLoading(true);
        setLoginError(null);
        const result = await login(data.email, data.password);
        if (result.success) {
            navigate(explicitFrom || getDefaultRoute(result.user), { replace: true });
        } else {
            setLoginError(result.message || t('auth.loginError'));
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex font-sans bg-slate-50">

            {/* ── LEFT PANEL ── */}
            <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12"
                style={{ background: `linear-gradient(135deg, ${theme.panelFrom} 0%, ${theme.panelMid} 50%, ${theme.panelTo} 100%)` }}>

                {/* Decorative circles */}
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full blur-3xl"
                    style={{ background: `${theme.primary}18` }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/5" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/5" />

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.primary})` }}>
                        <span className="text-white font-black text-xl">O</span>
                    </div>
                    <span className="text-white text-2xl font-black tracking-tight">
                        OMNI<span style={{ color: theme.accent }}>360</span>
                    </span>
                </div>

                {/* Main hero text */}
                <div className="relative z-10 space-y-6">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: theme.accent }}>
                            Enterprise Resource Platform
                        </p>
                        <h1 className="text-white text-4xl font-black leading-tight">
                            Gérez toute<br />
                            votre entreprise<br />
                            <span style={{ color: theme.accent }}>en un seul endroit.</span>
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                        ERP nouvelle génération conçu pour les opérations modernes — stocks, ventes, achats, logistique et reporting en temps réel.
                    </p>

                    {/* Feature pills */}
                    <div className="flex flex-col gap-3 pt-2">
                        {[
                            { icon: BarChart3, label: 'Analytique & Reporting temps réel', sub: 'Real-time Analytics & Reporting' },
                            { icon: Boxes, label: 'Gestion stocks & colisage avancée', sub: 'Advanced Inventory & Packaging Management' },
                            { icon: Globe2, label: 'Multi-entrepôts & Multi-devises', sub: 'Multi-warehouse & Multi-currency' },
                            { icon: Shield, label: 'Sécurité enterprise & accès RBAC', sub: 'Enterprise Security & Role-based Access' },
                            { icon: Smartphone, label: 'SFA Mobile avancé', sub: 'Advanced Sales Force Automation Mobile App' },
                        ].map(({ icon: Icon, label, sub }) => (
                            <div key={label} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4" style={{ color: theme.accent }} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-slate-200 text-sm leading-tight">{label}</span>
                                    <span className="text-slate-500 text-[11px] leading-tight mt-0.5">{sub}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom badge */}
                <div className="relative z-10">
                    <div className="inline-flex items-center mt-2 gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-slate-300 text-xs font-medium">Tous les systèmes opérationnels</span>
                    </div>
                </div>
            </div>

            {/* ── RIGHT PANEL (form) ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">

                {/* Mobile logo */}
                <div className="flex lg:hidden items-center gap-2 mb-10">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.primary})` }}>
                        <span className="text-white font-black text-lg">O</span>
                    </div>
                    <span className="text-slate-800 text-2xl font-black tracking-tight">
                        OMNI<span style={{ color: theme.primary }}>360</span>
                    </span>
                </div>

                <div className="w-full max-w-sm">
                    {/* Heading */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
                        <p className="text-slate-500 text-sm mt-1">Accédez à votre espace de travail</p>
                    </div>

                    {/* Error banner */}
                    {loginError && (
                        <div className="mb-5 p-3.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 flex items-start gap-2.5">
                            <Shield className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <span>{loginError}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    {...register('email', { required: t('auth.email') })}
                                    type="email"
                                    autoComplete="email"
                                    className={cn(
                                        "w-full pl-10 pr-4 h-11 border rounded-lg focus:outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 bg-white",
                                        errors.email ? "border-red-300" : "border-slate-300"
                                    )}
                                    style={!errors.email ? { '--tw-ring-color': theme.primary } as any : undefined}
                                    onFocus={e => { if (!errors.email) { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.light}`; }}}
                                    onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                                    placeholder={t('auth.emailPlaceholder')}
                                    defaultValue="admin@foodsolutions.ma"
                                />
                            </div>
                            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message as string}</p>}
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{t('auth.password')}</label>
                                <a href="#" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: theme.primary }}>
                                    {t('auth.forgotPassword')}
                                </a>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    {...register('password', { required: t('auth.password') })}
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    className={cn(
                                        "w-full pl-10 pr-11 h-11 border rounded-lg focus:outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 bg-white",
                                        errors.password ? "border-red-300" : "border-slate-300"
                                    )}
                                    onFocus={e => { if (!errors.password) { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.boxShadow = `0 0 0 3px ${theme.light}`; }}}
                                    onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = ''; }}
                                    placeholder="••••••••"
                                    defaultValue="secret"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message as string}</p>}
                        </div>

                        {/* Remember me */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="remember"
                                className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                                style={{ accentColor: theme.primary }}
                            />
                            <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer select-none">
                                Rester connecté
                            </label>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-11 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            style={{
                                background: `linear-gradient(to right, ${theme.primary}, ${theme.primaryDk})`,
                                boxShadow: `0 4px 14px ${theme.primary}40`,
                            }}
                            onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Connexion en cours…</span>
                                </>
                            ) : (
                                <span>{t('auth.signIn')}</span>
                            )}
                        </button>
                    </form>

                    {/* Divider + support */}
                    <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-xs text-slate-400">© 2026 OMNI360. All rights reserved.</p>
                        <a href="#" className="text-xs font-medium transition-colors hover:opacity-80" style={{ color: theme.primary }}>
                            Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
