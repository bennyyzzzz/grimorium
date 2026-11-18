import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LORE } from '../../constants/lore.js';
import { libraryService } from '../../services/library.js';

// Cola o link de um arquivo/Gist do GitHub e cria a entrada com o código importado.
export default function GithubImportForm({ onCancel }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tokenConfigured, setTokenConfigured] = useState(null);

  useEffect(() => {
    libraryService
      .githubStatus()
      .then((s) => setTokenConfigured(s.tokenConfigured))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { entry, existing } = await libraryService.importGithub(url.trim());
      navigate(`/biblioteca/${entry.id}`, {
        state: { notice: existing ? 'Este arquivo já estava na Biblioteca — abrimos a entrada existente.' : null },
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Link do arquivo no GitHub</span>
        <input
          className="input"
          type="url"
          required
          autoFocus
          placeholder="https://github.com/empresa/projeto/blob/main/tests/login.cy.js"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>

      <ul className="github-hints">
        <li>
          Abra o arquivo no GitHub e copie o endereço do navegador (<code>…/blob/branch/caminho</code>). Links “raw” e de
          Gist também funcionam.
        </li>
        <li>O código fica sincronizável: depois, use “Atualizar do GitHub” na entrada. Suas anotações nunca são sobrescritas.</li>
        <li>
          {tokenConfigured === null
            ? 'Verificando acesso a repositórios privados…'
            : tokenConfigured
              ? 'Token do GitHub configurado: repositórios privados aos quais ele tem acesso também funcionam.'
              : 'Sem token do GitHub: só repositórios públicos. Para privados, configure GITHUB_TOKEN no backend/.env.'}
        </li>
      </ul>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? LORE.fetchingGithub : 'Importar'}
        </button>
      </div>
    </form>
  );
}
