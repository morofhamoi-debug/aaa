import * as THREE from 'three';

export class RecoilSystem {
  constructor(cameraRig) {
    this.cameraRig = cameraRig;
    this.pitch = 0;
    this.yaw = 0;
    this.visualPitch = 0;
    this.visualYaw = 0;
    this.visualRoll = 0;
    this.patternIndex = 0;
  }

  addShot(config) {
    const pattern = config.recoilPattern?.length ? config.recoilPattern : [[0.028, 0.004]];
    const [pitch, yaw] = pattern[Math.min(this.patternIndex, pattern.length - 1)];
    const randomness = config.recoilRandomness ?? 0.16;
    const randomYaw = (Math.random() - 0.5) * randomness * Math.abs(yaw || pitch * 0.22);
    const cameraScale = config.recoilCameraScale ?? 0.72;
    this.pitch += pitch * cameraScale;
    this.yaw += (yaw + randomYaw) * cameraScale;
    this.visualPitch += pitch * (config.recoilWeaponScale ?? 1) * 3.2;
    this.visualYaw += (yaw + randomYaw) * 2.4;
    this.visualRoll += (yaw + randomYaw) * 0.9;
    this.patternIndex = (this.patternIndex + 1) % Math.max(1, pattern.length);
  }

  update(dt, config) {
    const recovery = config?.recoilRecovery ?? 8.5;
    const amount = 1 - Math.exp(-recovery * dt);
    this.pitch = THREE.MathUtils.lerp(this.pitch, 0, amount);
    this.yaw = THREE.MathUtils.lerp(this.yaw, 0, amount);
    this.visualPitch = THREE.MathUtils.lerp(this.visualPitch, 0, Math.min(1, amount * 1.25));
    this.visualYaw = THREE.MathUtils.lerp(this.visualYaw, 0, Math.min(1, amount * 1.25));
    this.visualRoll = THREE.MathUtils.lerp(this.visualRoll, 0, Math.min(1, amount * 1.25));
    this.cameraRig.recoilPitch = this.pitch;
    this.cameraRig.recoilYaw = this.yaw;
  }

  resetPattern() { this.patternIndex = 0; }
}
