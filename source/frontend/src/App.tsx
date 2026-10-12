import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { ApiError } from './lib/api';
import { PageSkeleton } from './components/ui/skeleton';
import { pageLoaders } from './lib/routes';

// Route-level code splitting: each page is its own chunk. Chunks are warmed up in the background
// after sign-in (see preloadPages), so navigation does not wait on a download.
const Login = lazy(pageLoaders.Login);
const Dashboard = lazy(pageLoaders.Dashboard);
const Outlets = lazy(pageLoaders.Outlets);
const OutletNew = lazy(pageLoaders.OutletNew);
const Menu = lazy(pageLoaders.Menu);
const MasterMenu = lazy(pageLoaders.MasterMenu);
const Inventory = lazy(pageLoaders.Inventory);
const Sales = lazy(pageLoaders.Sales);
const Receipt = lazy(pageLoaders.Receipt);
const Reports = lazy(pageLoaders.Reports);
const Users = lazy(pageLoaders.Users);
const UserNew = lazy(pageLoaders.UserNew);
const NotFound = lazy(pageLoaders.NotFound);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retry transient failures only; 4xx responses will not succeed on retry.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});



function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="outlets" element={<Outlets />} />
              <Route path="outlets/new" element={<OutletNew />} />
              <Route path="menu" element={<Menu />} />
              <Route path="menu/master" element={<MasterMenu />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="sales" element={<Sales />} />
              <Route path="sales/:saleId" element={<Receipt />} />
              <Route path="reports" element={<Reports />} />
              <Route path="users" element={<Users />} />
              <Route path="users/new" element={<UserNew />} />
            </Route>
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
