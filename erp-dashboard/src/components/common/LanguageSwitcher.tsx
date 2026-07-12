import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage, type SupportedLocale } from '@/context/LanguageContext';

const LOCALE_OPTIONS: { value: SupportedLocale; label: string; flag: string; native: string }[] = [
    { value: 'fr', label: 'Français', native: 'FR', flag: '🇫🇷' },
    { value: 'en', label: 'English',  native: 'EN', flag: '🇬🇧' },
    { value: 'ar', label: 'العربية',  native: 'AR', flag: '🇸🇦' },
];

export const LanguageSwitcher: React.FC = () => {
    const { locale, setLocale } = useLanguage();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const active = LOCALE_OPTIONS.find(o => o.value === locale) ?? LOCALE_OPTIONS[0];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-200 transition-colors"
                aria-label="Select language"
                aria-expanded={open}
            >
                <span className="text-base leading-none">{active.flag}</span>
                <span className="font-medium text-xs tracking-wide">{active.native}</span>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-40 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                    {LOCALE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => { setLocale(opt.value); setOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                                locale === opt.value
                                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                    : 'text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <span className="text-base">{opt.flag}</span>
                            <span className="flex-1 text-left">{opt.label}</span>
                            {locale === opt.value && (
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
