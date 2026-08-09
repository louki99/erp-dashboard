let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
    if (!_ctx) _ctx = new AudioContext();
    return _ctx;
}

function tone(ac: AudioContext, freq: number, startAt: number, dur: number, vol = 0.22): void {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(vol, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);

    osc.start(startAt);
    osc.stop(startAt + dur + 0.01);
}

/** Ascending 3-note chime — signals a new BC for the dispatcher. */
export function playNewOrderSound(): void {
    try {
        const ac = ctx();
        if (ac.state === 'suspended') ac.resume();
        const t = ac.currentTime;
        tone(ac, 880,  t,        0.22);
        tone(ac, 1100, t + 0.13, 0.22);
        tone(ac, 1320, t + 0.26, 0.30);
    } catch {
        // AudioContext blocked by browser policy — silently skip
    }
}
