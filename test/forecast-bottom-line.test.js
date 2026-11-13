import test from 'node:test';
import assert from 'node:assert/strict';
import { bottomLineForNow } from '../public/js/forecast-bottom-line.js';
test('Bottom Line follows the Asheville forecast date and expires at 3 PM in both seasons', () => {
  const days = {'2026-11-13':{bottomLine:' Cold and breezy. '},'2026-07-01':{bottomLine:'Warm.'}};
  for (const [instant, text] of [['2026-11-13T19:59:59.999Z','Cold and breezy.'],['2026-07-01T18:59:59.999Z','Warm.']]) {
    const now = new Date(instant);
    assert.deepEqual(bottomLineForNow({days}, now), {text,remainingMs:1});
    assert.equal(bottomLineForNow({days}, new Date(+now + 1)), null);
  }
  assert.equal(bottomLineForNow({days}, new Date('2026-11-14T13:00:00Z')), null);
  assert.equal(bottomLineForNow({days:{'2026-11-13':{bottomLine:'  '}}}, new Date('2026-11-13T13:00:00Z')), null);
});
