import { describe, expect, it } from 'vitest'
import { DEFAULT_CS_TEAM, mergeAllowlist, parseAllowlist } from './allowlist'

describe('parseAllowlist', () => {
  it('czyta email i rolę', () => {
    expect(parseAllowlist('martyna.kalicka@sun.store:admin, antoni.pajestka@sun.store')).toEqual([
      { email: 'martyna.kalicka@sun.store', role: 'admin' },
      { email: 'antoni.pajestka@sun.store', role: 'lead' }
    ])
  })

  it('odrzuca śmieci bez @', () => {
    expect(parseAllowlist('nie-email:admin')).toEqual([])
  })
})

describe('mergeAllowlist', () => {
  it('nie trzyma hardcoded listy w repo', () => {
    expect(DEFAULT_CS_TEAM).toEqual([])
    expect(mergeAllowlist('')).toEqual([])
  })

  it('bierze tylko AUTH_ALLOWLIST z env', () => {
    const merged = mergeAllowlist('armand.banaszkiewicz@sun.store:admin,martyna.kalicka@sun.store:admin')
    expect(merged).toEqual([
      { email: 'armand.banaszkiewicz@sun.store', role: 'admin' },
      { email: 'martyna.kalicka@sun.store', role: 'admin' }
    ])
  })
})
