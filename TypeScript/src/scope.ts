export function isGlobalScope(scope: string | null | undefined): boolean {
  return scope === undefined || scope === null || scope === 'global';
}
