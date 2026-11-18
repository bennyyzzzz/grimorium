import { useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import CopyButton from '../CopyButton/CopyButton.jsx';
import './Markdown.css';

// Bloco de código com botão de copiar.
function CodeBlock({ children, node, ...props }) {
  const ref = useRef(null);
  const language = node?.children?.[0]?.properties?.className
    ?.find((c) => String(c).startsWith('language-'))
    ?.replace('language-', '');

  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{language || 'código'}</span>
        <CopyButton getText={() => ref.current?.textContent ?? ''} className="md-code-copy" />
      </div>
      <pre ref={ref} {...props}>
        {children}
      </pre>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
};

/**
 * Renderiza Markdown (GFM: tabelas, listas de tarefas, tachado) com destaque de código.
 * HTML embutido no texto NÃO é interpretado (padrão do react-markdown) — seguro contra scripts.
 */
export default function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
