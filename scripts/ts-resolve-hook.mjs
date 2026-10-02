// Resolve hook so Node's built-in TS type stripping can load the app's
// extensionless relative imports (Metro-style). Dev verification only.
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
