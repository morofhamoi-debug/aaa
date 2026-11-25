export class WeaponBase {
  constructor(config) {
    this.config = config;
    this.magazine = config.magazine;
    this.reserve = config.reserve;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.reloading = false;
    this.emptyClickCooldown = 0;
    this.shotsFired = 0;
  }

  update(dt) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.emptyClickCooldown = Math.max(0, this.emptyClickCooldown - dt);
    if (!this.reloading) return null;
    this.reloadTimer -= dt;
    if (this.reloadTimer > 0) return null;
    if (this.config.reloadStyle === 'shell') {
      if (this.magazine < this.config.magazine && this.reserve > 0) {
        this.magazine++;
        this.reserve--;
        if (this.magazine < this.config.magazine && this.reserve > 0) this.reloadTimer = this.config.reloadTime;
        else this.reloading = false;
        return { shell: true, complete: !this.reloading };
      }
      this.reloading = false;
      return { shell: false, complete: true };
    }
    const needed = Math.max(0, this.config.magazine - this.magazine);
    const transferred = Math.min(needed, this.reserve);
    this.magazine += transferred;
    this.reserve -= transferred;
    this.reloading = false;
    return { shell: false, complete: true, transferred };
  }

  canFire() { return !this.reloading && this.fireCooldown <= 0 && (this.config.fireMode === 'melee' || this.magazine > 0); }

  consumeShot() {
    if (!this.canFire()) return false;
    if (this.config.fireMode !== 'melee') this.magazine = Math.max(0, this.magazine - 1);
    this.fireCooldown = 60 / Math.max(1, this.config.fireRate);
    this.shotsFired++;
    return true;
  }

  startReload() {
    if (this.config.fireMode === 'melee' || this.reloading || this.magazine >= this.config.magazine || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTimer = this.config.reloadStyle === 'shell' ? this.config.reloadTime : this.config.reloadTime;
    return true;
  }

  cancelReload() { this.reloading = false; this.reloadTimer = 0; }

  getSnapshot() {
    return { id: this.config.id, magazine: this.magazine, reserve: this.reserve, reloading: this.reloading, fireMode: this.config.fireMode };
  }
}
