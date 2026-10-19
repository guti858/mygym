import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { peckContent } from './content';
import { peckLogic } from './logic';

describe('Peck-deck', () => {
  test('contenido coherente', () => checkContent(peckContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(peckLogic, peckContent));
  test('cada error dispara sus alertas', () => checkErrors(peckLogic, peckContent));
});
