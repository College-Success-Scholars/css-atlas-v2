/**
 * Chainable PostgREST-style query double: every method returns the same builder and
 * awaiting it resolves with the configured result. Records each call for assertions.
 */
export type RecordedCall = [method: string, args: unknown[]];

export function fakeQuery(
  result: { data: unknown; error?: unknown } | ((range: { from: number; to: number } | null) => { data: unknown; error?: unknown }),
) {
  const calls: RecordedCall[] = [];
  let range: { from: number; to: number } | null = null;
  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
            const value = typeof result === "function" ? result(range) : result;
            return Promise.resolve({ error: null, ...value }).then(resolve, reject);
          };
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), args]);
          if (prop === "range") range = { from: Number(args[0]), to: Number(args[1]) };
          return builder;
        };
      },
    },
  );
  return { query: builder, calls };
}

export function callsTo(calls: RecordedCall[], method: string): unknown[][] {
  return calls.filter(([name]) => name === method).map(([, args]) => args);
}
