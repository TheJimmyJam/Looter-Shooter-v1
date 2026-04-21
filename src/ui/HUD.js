const ITEM_META = {
  crystal: { icon: '💎', label: 'Crystal Shard' },
  scrap:   { icon: '⚙️',  label: 'Metal Scrap' },
  health:  { icon: '💊',  label: 'Med Pack' },
  ore:     { icon: '🪨',  label: 'Ore Chunk' },
};

export class HUD {
  constructor(player, weapon, lootSystem) {
    this.player = player;
    this.weapon = weapon;
    this.lootSystem = lootSystem;

    this.healthBar    = document.getElementById('health-bar');
    this.healthText   = document.getElementById('health-text');
    this.ammoCount    = document.getElementById('ammo-count');
    this.ammoReserve  = document.getElementById('ammo-reserve');
    this.killCount    = document.getElementById('kill-count');
    this.invPanel     = document.getElementById('inventory-panel');
    this.invGrid      = document.getElementById('inventory-grid');

    this.inventoryOpen = false;
  }

  update() {
    const p = this.player;
    const w = this.weapon;

    // Health bar
    const pct = p.health / p.maxHealth;
    if (this.healthBar) {
      this.healthBar.style.width = `${pct * 100}%`;
      if (pct > 0.5) {
        this.healthBar.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
      } else if (pct > 0.25) {
        this.healthBar.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
      } else {
        this.healthBar.style.background = 'linear-gradient(90deg, #dc2626, #ef4444)';
      }
    }
    if (this.healthText) {
      this.healthText.textContent = `${Math.ceil(p.health)} / ${p.maxHealth}`;
    }

    // Ammo
    if (this.ammoCount) {
      this.ammoCount.textContent = w.reloading ? 'RELOAD' : w.ammo;
      this.ammoCount.style.color = w.ammo === 0 ? '#ef4444' : w.ammo <= 5 ? '#f59e0b' : '#f9fafb';
    }
    if (this.ammoReserve) {
      this.ammoReserve.textContent = `/ ${w.reserveAmmo}`;
    }

    // Kill counter
    if (this.killCount) {
      this.killCount.textContent = `☠ ${p.kills} Kill${p.kills !== 1 ? 's' : ''}`;
    }

    // Update inventory grid if open
    if (this.inventoryOpen) {
      this.renderInventory();
    }
  }

  toggleInventory(open) {
    this.inventoryOpen = open;
    if (this.invPanel) {
      if (open) {
        this.invPanel.classList.add('visible');
        this.renderInventory();
      } else {
        this.invPanel.classList.remove('visible');
      }
    }
  }

  renderInventory() {
    if (!this.invGrid) return;
    this.invGrid.innerHTML = '';

    const items = this.player.getInventoryList();

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column: span 4; color: #4b5563; font-size: 0.8rem; text-align: center; padding: 1rem;';
      empty.textContent = 'Inventory empty — go loot something';
      this.invGrid.appendChild(empty);
      return;
    }

    items.forEach(({ type, count }) => {
      const meta = ITEM_META[type] || { icon: '📦', label: type };
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.innerHTML = `
        <div class="item-icon">${meta.icon}</div>
        <div>${meta.label}</div>
        <div class="item-count">${count}</div>
      `;
      this.invGrid.appendChild(slot);
    });
  }

  reset() {
    this.inventoryOpen = false;
    if (this.invPanel) this.invPanel.classList.remove('visible');
    if (this.invGrid) this.invGrid.innerHTML = '';
  }
}
