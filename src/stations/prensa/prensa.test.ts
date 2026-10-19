import { describe, test } from 'vitest';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { prensaContent } from './content';
import { prensaLogic } from './logic';

describe('Prensa de piernas 45°', () => {
  test('contenido coherente', () => checkContent(prensaContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(prensaLogic, prensaContent));
  test('cada error dispara sus alertas', () => checkErrors(prensaLogic, prensaContent));
});
