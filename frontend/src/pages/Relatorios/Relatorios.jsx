import PageHeader from '../../components/PageHeader/PageHeader.jsx';
import EmptyState from '../../components/EmptyState/EmptyState.jsx';

export default function Relatorios() {
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Relatórios diários gerados com IA" />
      <EmptyState title="Relatórios em breve">
        Geração com Claude, histórico e download em PDF serão implementados na Etapa 4.
      </EmptyState>
    </>
  );
}
