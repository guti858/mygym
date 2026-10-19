import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { militarContent } from './content';
import { militarLogic } from './logic';

describe('Press militar (máquina)', () => {
  test('contenido coherente', () => checkContent(militarContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(militarLogic, militarContent));
  test('cada error dispara sus alertas', () => checkErrors(militarLogic, militarContent));
});
