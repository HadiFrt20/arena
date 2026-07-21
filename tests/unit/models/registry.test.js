import { jest } from '@jest/globals';

// The registry is a pure, dependency-free module — import it directly.
const { register, lookup, has, list, instantiate } = await import('../../../src/models/registry.js');

describe('provider registry', () => {
  test('register + lookup round-trips a declaration', () => {
    const decl = { name: 'reg-test-a', Provider: class {}, config: { apiKeyEnv: 'A_KEY' } };
    register(decl);
    expect(lookup('reg-test-a')).toBe(decl);
    expect(has('reg-test-a')).toBe(true);
  });

  test('has() is false for unknown names', () => {
    expect(has('definitely-not-registered')).toBe(false);
    expect(lookup('definitely-not-registered')).toBeUndefined();
  });

  test('list() returns all registered declarations', () => {
    register({ name: 'reg-test-b', Provider: class {} });
    const names = list().map((d) => d.name);
    expect(names).toContain('reg-test-b');
  });

  test('register() is idempotent by name (last write wins)', () => {
    register({ name: 'reg-test-c', Provider: class First {} });
    register({ name: 'reg-test-c', Provider: class Second {} });
    const decls = list().filter((d) => d.name === 'reg-test-c');
    expect(decls).toHaveLength(1);
    expect(decls[0].Provider.name).toBe('Second');
  });

  test('register() rejects a non-object declaration', () => {
    expect(() => register(null)).toThrow(/requires a declaration object/);
    expect(() => register('nope')).toThrow(/requires a declaration object/);
  });

  test('register() requires a string name', () => {
    expect(() => register({ Provider: class {} })).toThrow(/string "name"/);
    expect(() => register({ name: 42, Provider: class {} })).toThrow(/string "name"/);
  });

  test('register() requires a Provider class or create() factory', () => {
    expect(() => register({ name: 'reg-test-d' })).toThrow(/Provider class or a create\(\) factory/);
  });

  test('instantiate() uses the Provider class by default', () => {
    class Widget {
      constructor(model) { this.model = model; }
    }
    const decl = register({ name: 'reg-test-e', Provider: Widget });
    const inst = instantiate(decl, 'm-1');
    expect(inst).toBeInstanceOf(Widget);
    expect(inst.model).toBe('m-1');
  });

  test('instantiate() prefers a create() factory when present', () => {
    const decl = register({
      name: 'reg-test-f',
      create: (model) => ({ built: true, model })
    });
    const inst = instantiate(decl, 'm-2');
    expect(inst).toEqual({ built: true, model: 'm-2' });
  });
});
