import assert from 'node:assert/strict';
import {
  formatBalance, formatPrice, slugify, isValidHandle, rarityClass, safeText
} from '../src/vexa/utils.js';

assert.equal(formatBalance(0, 'RUB'), '0');
assert.equal(formatBalance(100, 'USD', 100), '1');
assert.equal(formatPrice(null), '—');
assert.equal(slugify('VEXA Rare Gift'), 'vexa-rare-gift');
assert.equal(isValidHandle('vexa_user01'), true);
assert.equal(isValidHandle('bad handle'), false);
assert.equal(isValidHandle('ab'), false);
assert.equal(rarityClass('Legendary'), 'legendary');
assert.equal(rarityClass('Мифическая'), 'mythic');
assert.equal(safeText('  VEXA  '), 'VEXA');
assert.equal(safeText('', 'Пусто'), 'Пусто');

console.log('VEXA utility tests passed.');
