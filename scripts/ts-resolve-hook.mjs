import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Use the locked compiler: some Node builds omit native type stripping.
// This runner executes tests; `tsc --noEmit` remains the separate type check.
export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && url.endsWith('.ts')) {
    const source = await readFile(new URL(url), 'utf8');
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
    }).outputText };
  }
  return nextLoad(url, context);
}

// Resolve extensionless relative imports as Metro does. Dev verification only.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    if (error?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') {
      return nextResolve(`${specifier}/index.js`, context);
    }
    throw error;
  }
}
