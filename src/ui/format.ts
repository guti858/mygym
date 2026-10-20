/** Número en formato español: coma decimal y signo menos tipográfico (−); sin «−0». */
export const num = (v: number, digits = 0) =>
  v
    .toFixed(digits)
    .replace(/^-(?=.*[1-9])/, '−')
    .replace(/^-/, '')
    .replace('.', ',');

/** Ángulo redondeado en grados con signo tipográfico. */
export const deg = (v: number) => `${num(Math.round(v))}°`;
