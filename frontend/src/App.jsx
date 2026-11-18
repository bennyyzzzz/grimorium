import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout/Layout.jsx';
import Summoning from './components/Summoning/Summoning.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Demandas from './pages/Demandas/Demandas.jsx';
import Relatorios from './pages/Relatorios/Relatorios.jsx';

// A Biblioteca (com o renderizador de Markdown) só é baixada quando acessada.
const Biblioteca = lazy(() => import('./pages/Biblioteca/Biblioteca.jsx'));
const EntryView = lazy(() => import('./pages/Biblioteca/EntryView.jsx'));
const EntryEditor = lazy(() => import('./pages/Biblioteca/EntryEditor.jsx'));

const lazyPage = (Page) => (
  <Suspense fallback={<Summoning />}>
    <Page />
  </Suspense>
);

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="demandas" element={<Demandas />} />
        <Route path="biblioteca" element={lazyPage(Biblioteca)} />
        <Route path="biblioteca/nova" element={lazyPage(EntryEditor)} />
        <Route path="biblioteca/:id" element={lazyPage(EntryView)} />
        <Route path="biblioteca/:id/editar" element={lazyPage(EntryEditor)} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
