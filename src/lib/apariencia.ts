/** Paleta de arranque; desde la pantalla se puede elegir cualquier otro color. */
export const SUGERIDOS = [
  { nombre: "Lila", hex: "#5b2ee5" },
  { nombre: "Índigo", hex: "#3b4fd8" },
  { nombre: "Celeste", hex: "#0b6fa4" },
  { nombre: "Verde", hex: "#0f7a52" },
  { nombre: "Ámbar", hex: "#b4690e" },
  { nombre: "Ladrillo", hex: "#b03a2e" },
  { nombre: "Magenta", hex: "#a51e86" },
  { nombre: "Grafito", hex: "#3f4458" },
] as const;

export const ES_HEX = /^#[0-9a-f]{6}$/i;

/** Fuera de 20 el color se vuelve ilegible o invisible; se recorta ahí. */
export const recorta = (n: number, min = 20, max = 100) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : max;

const canales = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** Baja la intensidad mezclando con gris medio. */
const haciaGris = (c: number, t: number) => Math.round(c * t + 128 * (1 - t));

/** Luminancia relativa sRGB, para decidir si encima va texto claro u oscuro. */
function luminancia([r, g, b]: [number, number, number]) {
  const lineal = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);
}

/**
 * Traduce la elección de la persona a los dos tokens que usa la interfaz:
 * el color de marca y el color del texto que va encima.
 */
export function marca(hex: string, intensidad: number, alpha: number) {
  const base = canales(hex);
  const t = recorta(intensidad) / 100;
  const [r, g, b] = base.map((c) => haciaGris(c, t)) as [number, number, number];
  const a = recorta(alpha) / 100;
  // Con transparencia, el color se ve mezclado con el fondo: para el contraste
  // se calcula sobre blanco, que es el caso más exigente.
  const sobreBlanco = [r, g, b].map((c) => c * a + 255 * (1 - a)) as [number, number, number];
  return {
    stamp: a === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`,
    oncolor: luminancia(sobreBlanco) > 0.45 ? "#141529" : "#ffffff",
  };
}
