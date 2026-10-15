import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVAILABLE_MODEL_IDS, DEFAULT_MODEL_ID, ZOVO_MODELS, normalizeModelId, getModelDisplayName } from '../src/lib/models.js';

test('only the two hosted providers are selectable with Zovo names', () => {
  assert.deepEqual(ZOVO_MODELS.map(m => m.id), [...AVAILABLE_MODEL_IDS]);
  assert.deepEqual(ZOVO_MODELS.map(m => m.displayName), ['Zovo Fast', 'Zovo Flex']);
  assert.equal(DEFAULT_MODEL_ID, 'groq/openai/gpt-oss-20b');
  assert.equal(ZOVO_MODELS.filter(m => m.isDefault).length, 1);
});

test('retired saved models use the active default without relabelling historical Gemini answers', () => {
  for (const old of ['gemini-3.8-flash', 'gemini-3.7-flash', undefined, 'unknown']) {
    assert.equal(normalizeModelId(old), DEFAULT_MODEL_ID);
  }
  assert.equal(normalizeModelId('openrouter/free'), 'openrouter/free');
  assert.equal(getModelDisplayName('groq/openai/gpt-oss-20b'), 'Zovo Fast');
  assert.equal(getModelDisplayName('openrouter/some-free-model'), 'Zovo Flex');
  assert.equal(getModelDisplayName('gemini-3.8-flash'), 'Zovo Legacy');
});
