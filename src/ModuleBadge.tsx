const MODULE_BADGES: Record<string, string> = {
  module: 'module',
  relaySync: 'relaySync',
  coil: 'coil',
  salvage: 'salvage',
  ember: 'ember',
  coldAftershock: 'coldAftershock',
  droneCare: 'droneCare',
  alloy: 'alloy',
  bossBreaker: 'bossBreaker',
}

/** The surrounding module name supplies the accessible label. */
export default function ModuleBadge({ type = 'module' }: { type?: string }) {
  const badge = Object.prototype.hasOwnProperty.call(MODULE_BADGES, type) ? MODULE_BADGES[type] : 'module'
  return <img className="module-badge" src={`/assets/modules/${badge}.webp`} width="384" height="384" alt="" aria-hidden="true" draggable={false} />
}
