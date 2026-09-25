import { describe, expect, it } from 'vitest'
import { mergeAllowlist, parseAllowlist } from './allowlist'

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
  it('env nadpisuje domyślną rolę', () => {
    const merged = mergeAllowlist('armand.banaszkiewicz@sun.store:admin')
    expect(merged.find(entry => entry.email === 'armand.banaszkiewicz@sun.store')?.role).toBe('admin')
    expect(merged.find(entry => entry.email === 'martyna.kalicka@sun.store')?.role).toBe('admin')
  })
})
