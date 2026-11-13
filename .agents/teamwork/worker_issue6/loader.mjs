import { statSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND' && context.parentURL) {
      const parentDir = fileURLToPath(new URL('.', context.parentURL));
      for (const suffix of ['.js', '.jsx', '/index.js', '.json']) {
        try {
          return await nextResolve(specifier + suffix, context);
        } catch {}
      }
    }
    throw err;
  }
}
