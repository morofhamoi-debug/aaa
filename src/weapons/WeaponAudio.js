export class WeaponAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.unlocked = false;
    this.volume = 0.22;
  }

  async unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.unlocked = this.context.state === 'running';
    return this.unlocked;
  }

  #tone(frequency, duration, type = 'triangle', gain = 0.12, endFrequency = frequency * 0.55) {
    if (!this.unlocked || !this.context) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), now + duration);
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.015);
  }

  play(event, weaponId = 'ak47') {
    if (!this.unlocked) return;
    const suppressed = ['m4a1s', 'usps', 'mp5sd'].includes(weaponId);
    const heavy = ['awp', 'deagle', 'nova', 'xm1014'].includes(weaponId);
    if (event === 'fire') this.#tone(suppressed ? 155 : heavy ? 95 : 125, heavy ? 0.13 : 0.075, 'sawtooth', heavy ? 0.2 : 0.12, 42);
    else if (event === 'reload') this.#tone(520 + Math.random() * 100, 0.045, 'square', 0.055, 220);
    else if (event === 'empty') this.#tone(230, 0.045, 'square', 0.035, 180);
    else if (event === 'equip') this.#tone(430, 0.055, 'triangle', 0.045, 320);
    else if (event === 'hit') this.#tone(760, 0.035, 'sine', 0.035, 600);
    else if (event === 'impact') this.#tone(175, 0.055, 'triangle', 0.045, 90);
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  dispose() { this.context?.close(); this.context = null; this.unlocked = false; }
}
