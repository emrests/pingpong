import { describe, it, expect, vi } from 'vitest';

vi.mock('peerjs', () => ({ Peer: class {} }));

const { makeCode } = await import('../src/net.js');

describe('makeCode', () => {
  it('makes 4 unambiguous uppercase characters', () => {
    for (let i = 0; i < 50; i++) expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  });

  it('uses the supplied rng', () => {
    expect(makeCode(() => 0)).toBe('AAAA');
  });
});
