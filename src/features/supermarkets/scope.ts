// Request scope is captured before asynchronous token reads. Switching never mutates a request in flight.
let scope: string | null = null;
let generation = 0;
let writes = 0;
export const getSupermarketScope = () => ({ id: scope, generation });
export const setSupermarketScope = (id: string | null) => { scope = id; generation += 1; };
export const beginScopedWrite = () => { writes += 1; };
export const endScopedWrite = () => { writes = Math.max(0, writes - 1); };
export const hasScopedWrites = () => writes > 0;
