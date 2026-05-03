import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getPort } from '../src/server.js';

describe('server startup helpers', () => {
  it('uses PORT from the environment when provided', () => {
    assert.equal(getPort({ PORT: '4321' }), 4321);
  });

  it('defaults to 3000 when PORT is missing', () => {
    assert.equal(getPort({}), 3000);
  });
});
