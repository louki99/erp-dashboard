export interface HSL {
    h: number;
    s: number;
    l: number;
}

export function hexToHSL(hex: string): HSL {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return { h: 0, s: 0, l: 0 };
    }
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r /= 255;
    g /= 255;
    b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max == min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToString(hsl: HSL): string {
    return `${hsl.h.toFixed(1)} ${hsl.s.toFixed(1)}% ${hsl.l.toFixed(1)}%`;
}

// Generate a simplified palette (50, 100, 500, 600, 700, 900) based on base color
export function generateSagePalette(baseHex: string) {
    const base = hexToHSL(baseHex);

    // This is a naive generation for demonstration. A proper color system would be more complex.
    // We assume the base color is around the 500-600 weight.

    return {
        '--sage-50': hslToString({ h: base.h, s: Math.max(0, base.s - 20), l: 97 }),
        '--sage-100': hslToString({ h: base.h, s: Math.max(0, base.s - 20), l: 93 }),
        '--sage-500': hslToString({ ...base }), // Base color
        '--sage-600': hslToString({ h: base.h, s: base.s, l: Math.max(0, base.l - 10) }),
        '--sage-700': hslToString({ h: base.h, s: base.s, l: Math.max(0, base.l - 20) }),
        '--sage-900': hslToString({ h: base.h, s: base.s, l: Math.max(0, base.l - 35) }),

        // Also map to primary/ring for consistency
        '--primary': hslToString({ ...base }),
        '--ring': hslToString({ ...base }),
    };
}
