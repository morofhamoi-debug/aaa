import { GAME_CONFIG } from '../core/Config.js';

export class PlayerPhysics {
  constructor(collisionWorld) {
    this.world = collisionWorld;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.lastCollision = null;
  }

  bufferJump() { this.jumpBufferTimer = GAME_CONFIG.player.jumpBuffer; }

  update(player, dt, jumpRequested) {
    const cfg = GAME_CONFIG.player;
    if (jumpRequested) this.bufferJump();
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.grounded) this.coyoteTimer = cfg.coyoteTime;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0 && !player.movement.crouched) {
      player.movement.setVerticalVelocity(cfg.jumpVelocity);
      this.grounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      player.events.emit('player:jump', {});
    }

    const targetHeight = player.movement.crouched ? cfg.crouchingHeight : cfg.standingHeight;
    if (!player.movement.crouched && player.currentHeight < cfg.standingHeight - 0.01) {
      const candidate = { x: player.position.x, y: player.position.y, z: player.position.z };
      if (this.world.hasClearance(candidate, cfg.standingHeight, cfg.radius)) player.currentHeight = Math.min(cfg.standingHeight, player.currentHeight + 7.5 * dt);
      else player.movement.crouched = true;
    } else if (player.movement.crouched) {
      player.currentHeight = Math.max(targetHeight, player.currentHeight - 8.5 * dt);
    } else {
      player.currentHeight = Math.min(cfg.standingHeight, player.currentHeight + 8.5 * dt);
    }

    const oldGrounded = this.grounded;
    const preImpactSpeed = Math.abs(player.movement.velocity.y);
    const vertical = this.world.moveVertical(player.position, player.movement.velocity.y - cfg.gravity * dt, dt, player.currentHeight, cfg.radius);
    player.position.copy(vertical.position);
    player.movement.velocity.y = vertical.grounded ? 0 : Math.max(-cfg.maxFallSpeed, player.movement.velocity.y - cfg.gravity * dt);
    this.grounded = vertical.grounded;
    this.lastCollision = vertical.hit;
    if (!oldGrounded && this.grounded) player.events.emit('player:landed', { impactSpeed: preImpactSpeed });

    const horizontal = this.world.moveHorizontal(player.position, player.movement.velocity, dt, player.currentHeight, cfg.radius, cfg.maxStepHeight);
    player.position.x = horizontal.position.x;
    player.position.z = horizontal.position.z;
  }
}
