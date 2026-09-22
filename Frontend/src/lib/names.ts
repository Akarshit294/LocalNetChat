// The one line under a name box, wherever that box is.
//
// The rules before you type, then the rule you are breaking, then what the
// server said about the name — in words rather than in its own vocabulary.

export const NAME_RULES = '4–20 characters, one number, no spaces';

// The door has a Join button sitting where the rest of that line would go. The
// digit is the rule nobody guesses; a space announces itself the moment you
// type one, so that is the half that goes.
export const NAME_RULES_SHORT = '4–20 characters, one number';

// what useNameCheck's one-word answers mean to somebody who has never seen this
const ANSWERS: Record<string, string> = {
  'checking...': 'checking…',
  available: 'that name is free',
  unavailable: 'someone here is already called that',
  unreachable: "can't reach the server",
};

export function nameNote(value: string, error: string | null, status: string, hint = NAME_RULES) {
  // an empty box is where you start, so don't call it an error yet
  const problem = value ? error : null;
  const answer = status ? (ANSWERS[status] ?? status) : '';
  return {
    line: problem || answer || hint,
    problem: problem !== null,
    free: problem === null && status === 'available',
  };
}
