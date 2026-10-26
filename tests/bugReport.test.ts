import {
  bugReportTitle,
  MAX_MESSAGE_LENGTH,
  prepareBugReport,
} from '../src/debug/bugReportValidation';
import { assert, assertEqual, suite, test } from './harness';

/**
 * The in-app bug reporter has to fail safely: too little text should be
 * caught before anything is sent, and a message a player pastes in full
 * should never blow past what the HQ board or the database expects.
 */
suite('bug report · validation', () => {
  test('a blank or near-empty report is rejected', () => {
    for (const attempt of ['', '   ', 'hi', 'nope']) {
      const result = prepareBugReport(attempt);
      assert(!result.ok, `"${attempt}" should have been rejected`);
    }
  });

  test('whitespace alone does not count toward the minimum', () => {
    const result = prepareBugReport('     x    ');
    assert(!result.ok, 'padding a single character with spaces should still fail');
  });

  test('a real report is trimmed and accepted', () => {
    const result = prepareBugReport('  The dice got stuck on the moat.  ');
    assert(result.ok, 'a genuine report should be accepted');
    if (result.ok) {
      assertEqual(result.message, 'The dice got stuck on the moat.', 'trimming');
    }
  });

  test('an extremely long report is capped, not rejected', () => {
    const huge = 'x'.repeat(MAX_MESSAGE_LENGTH + 500);
    const result = prepareBugReport(huge);
    assert(result.ok, 'a long report should still be accepted, just capped');
    if (result.ok) {
      assertEqual(result.message.length, MAX_MESSAGE_LENGTH, 'cap length');
    }
  });
});

suite('bug report · board title', () => {
  test('a short report is its own title', () => {
    assertEqual(bugReportTitle('The dice froze'), 'The dice froze', 'short title');
  });

  test('a long report is cut with an ellipsis, never mid-word cruelly', () => {
    const long =
      'The dice got stuck when I tapped the screen twice very quickly right before the roll settled and the game froze completely';
    const title = bugReportTitle(long);
    assert(title.length <= 80, 'title should respect the length cap');
    assert(title.endsWith('...'), 'a cut title should say so');
    assert(long.startsWith(title.slice(0, -3)), 'the cut must be a true prefix');
  });
});
