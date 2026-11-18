import { useState } from 'react';

const normalize = (value) => value.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '-');

// Campo de tags: Enter ou vírgula adiciona; Backspace no campo vazio remove a última.
export default function TagInput({ value, onChange, suggestions = [], max = 10 }) {
  const [draft, setDraft] = useState('');

  function add(raw) {
    const tag = normalize(raw);
    setDraft('');
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span key={tag} className="tag tag-static">
          #{tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remover tag ${tag}`}>
            ×
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          list="library-tag-suggestions"
          value={draft}
          placeholder={value.length ? '' : 'ex.: cypress, deploy, vpn'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => draft && add(draft)}
          aria-label="Adicionar tag"
          maxLength={30}
        />
      )}
      <datalist id="library-tag-suggestions">
        {suggestions.filter((s) => !value.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
