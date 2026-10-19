import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { jalonContent } from './content';
import { jalonLogic } from './logic';

describe('Jalón al pecho', () => {
  test('contenido coherente', () => checkContent(jalonContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(jalonLogic, jalonContent));
  test('cada error dispara sus alertas', () => checkErrors(jalonLogic, jalonContent));
});
