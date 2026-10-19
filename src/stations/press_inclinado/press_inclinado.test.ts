import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { inclinadoContent } from './content';
import { inclinadoLogic } from './logic';

describe('Press inclinado de pecho (máquina)', () => {
  test('contenido coherente', () => checkContent(inclinadoContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(inclinadoLogic, inclinadoContent));
  test('cada error dispara sus alertas', () => checkErrors(inclinadoLogic, inclinadoContent));
});
