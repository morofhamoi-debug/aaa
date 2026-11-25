export const GAME_CONFIG = Object.freeze({
  appName: 'TACTICAL STRIKE',
  fixedTimeStep: 1 / 120,
  maxFrameDelta: 0.05,
  maxSubSteps: 8,
  debug: false,
  graphics: {
    profile: 'HIGH',
    maxPixelRatio: 1.75,
    shadowMapSize: 1024,
    fogNear: 32,
    fogFar: 105,
    exposure: 1.05
  },
  player: {
    radius: 0.32,
    standingHeight: 1.8,
    crouchingHeight: 1.2,
    standingEyeHeight: 1.62,
    crouchingEyeHeight: 1.05,
    walkSpeed: 4.25,
    sprintSpeed: 5.8,
    crouchSpeed: 1.8,
    groundAcceleration: 28,
    groundFriction: 12,
    airAcceleration: 5.5,
    airControl: 0.28,
    gravity: 22,
    jumpVelocity: 7.25,
    maxFallSpeed: 34,
    coyoteTime: 0.08,
    jumpBuffer: 0.09,
    maxStepHeight: 0.32,
    mouseSensitivity: 0.0021,
    verticalSensitivity: 1,
    invertY: false,
    minPitch: -1.52,
    maxPitch: 1.52,
    cameraBob: 0.018
  },
  weapons: {
    maxShells: 28,
    maxImpactParticles: 120,
    maxTracers: 14,
    defaultWeapon: 'ak47'
  }
});

export const GRAPHICS_PROFILES = Object.freeze({
  LOW: { shadows: false, antialias: false, pixelRatio: 1, effects: false, far: 58 },
  MEDIUM: { shadows: true, antialias: true, pixelRatio: 1.25, effects: true, far: 78 },
  HIGH: { shadows: true, antialias: true, pixelRatio: 1.5, effects: true, far: 105 },
  ULTRA: { shadows: true, antialias: true, pixelRatio: 1.75, effects: true, far: 140 }
});
