import { formatBytes } from '../../constants/library.js';
import { libraryService } from '../../services/library.js';

const PREVIEWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

// Lista de anexos já salvos: miniatura para imagens, download para tudo.
export default function AttachmentList({ entryId, attachments, onRemove, disabled }) {
  return (
    <ul className="attachment-list">
      {attachments.map((a) => {
        const downloadUrl = libraryService.attachmentUrl(entryId, a.id);
        const isImage = PREVIEWABLE.has(a.mimeType);
        return (
          <li key={a.id} className="attachment">
            {isImage ? (
              <a href={libraryService.attachmentUrl(entryId, a.id, { inline: true })} target="_blank" rel="noopener noreferrer">
                <img
                  className="attachment-thumb"
                  src={libraryService.attachmentUrl(entryId, a.id, { inline: true })}
                  alt=""
                  loading="lazy"
                />
              </a>
            ) : (
              <span className="attachment-icon" aria-hidden="true">
                {(a.originalName.split('.').pop() || 'arq').slice(0, 4).toUpperCase()}
              </span>
            )}
            <div className="attachment-info">
              <a href={downloadUrl} download className="attachment-name">
                {a.originalName}
              </a>
              <span className="muted">{formatBytes(a.size)}</span>
            </div>
            <a href={downloadUrl} download className="btn btn-sm">
              Baixar
            </a>
            {onRemove && (
              <button
                type="button"
                className="btn-icon"
                onClick={() => onRemove(a)}
                disabled={disabled}
                aria-label={`Excluir ${a.originalName}`}
                title="Excluir anexo"
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
