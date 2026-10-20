/** Número con el signo menos tipográfico (−), como en el resto de la interfaz. */
export const num = (v: number, digits = 0) => v.toFixed(digits).replace(/^-(?=.*[1-9])/, '−').replace(/^-/, '');

/** Ángulo redondeado en grados con signo tipográfico. */
export const deg = (v: number) => `${num(Math.round(v))}°`;
