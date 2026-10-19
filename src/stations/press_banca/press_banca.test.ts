import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { bancaContent } from './content';
import { bancaLogic } from './logic';

describe('Press de banca con barra', () => {
  test('contenido coherente', () => checkContent(bancaContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(bancaLogic, bancaContent));
  test('cada error dispara sus alertas', () => checkErrors(bancaLogic, bancaContent));
});
