// Validates a live response against a golden contract example by shape and leaf type only.
// Values are never compared (weather data varies); arrays are checked against their first element.
export function assertMatchesContract(actual: unknown, golden: unknown, path = '$'): void {
  if (Array.isArray(golden)) {
    if (!Array.isArray(actual)) {
      throw new Error(`${path}: expected an array`);
    }
    const template = golden[0];
    if (template !== undefined) {
      actual.forEach((item, i) => assertMatchesContract(item, template, `${path}[${i}]`));
    }
    return;
  }

  if (golden !== null && typeof golden === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
      throw new Error(`${path}: expected an object`);
    }
    for (const key of Object.keys(golden as Record<string, unknown>)) {
      if (!(key in (actual as Record<string, unknown>))) {
        throw new Error(`${path}.${key}: missing in response`);
      }
      assertMatchesContract(
        (actual as Record<string, unknown>)[key],
        (golden as Record<string, unknown>)[key],
        `${path}.${key}`
      );
    }
    return;
  }

  if (typeof actual !== typeof golden) {
    throw new Error(`${path}: expected ${typeof golden} but got ${typeof actual}`);
  }
}
