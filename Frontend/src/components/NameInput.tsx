import { nameNote } from '../lib/names.ts';
import { color, type } from '../ui/theme.ts';
import { Field } from '../ui/primitives.tsx';

type NameInputProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  status: string;
  // what the line underneath says when there is nothing else to say
  hint?: string;
  placeholder?: string;
  // the door wants a pill, the rest of the app wants the usual 7px
  round?: boolean;
  onEnter?: () => void;
  autoFocus?: boolean;
};

// The name box, with one line underneath: the rule you are breaking, or what
// the server said about the name, or — before you have typed — the rules.
export default function NameInput({
  value,
  onChange,
  error,
  status,
  hint = '',
  placeholder = 'type a name...',
  round = false,
  onEnter,
  autoFocus,
}: NameInputProps) {
  const { line, problem, free } = nameNote(value, error, status, hint);

  return (
    <div style={{ flex: '1 1 220px', minWidth: 0 }}>
      <Field
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        ariaLabel="name"
        autoFocus={autoFocus}
        maxLength={20}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onEnter) {
            onEnter();
          }
        }}
        style={round ? { width: '100%', borderRadius: 999, padding: '11px 16px' } : { width: '100%' }}
      />
      {/* a sentence, not a label, so it isn't shouted in capitals */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginTop: 8,
          minHeight: 16,
          paddingLeft: round ? 5 : 0,
        }}
      >
        {free ? (
          <span
            style={{ width: 5, height: 5, borderRadius: '50%', background: color.mint, flex: '0 0 auto' }}
          />
        ) : null}
        <span style={{ ...type.meta, color: problem ? color.ink : color.inkFaint }}>
          {line}
        </span>
      </div>
    </div>
  );
}
