/**
 * Base64 → bytes para los recursos que viajan dentro del bundle (sala horneada, modelo anatómico).
 * Usa la decodificación nativa (`Uint8Array.fromBase64`) donde existe, varias veces más rápida que
 * recorrer el texto de `atob` en JavaScript (megabytes: un tirón al cargar), y si no, la de siempre.
 */
export function decodeBase64(b64: string): Uint8Array {
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array }).fromBase64;
  if (native) return native(b64);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Resuelve cuando el navegador queda libre (o como mucho en `timeout` ms). Los recursos pesados se
 * empiezan a evaluar y decodificar después de los primeros fotogramas, no encima de ellos.
 */
export function whenIdle(timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 200);
  });
}
