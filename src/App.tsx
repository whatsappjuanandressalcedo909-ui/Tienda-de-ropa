import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InventoryProvider } from './context/InventoryContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Receivables } from './pages/Receivables';
import { Customers } from './pages/Customers';
import { Settings } from './pages/Settings';
import { AdminLogin } from './pages/AdminLogin';
import { ProductForm } from './components/ProductForm';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Admin Login Route */}
          <Route path="/login/admin" element={<AdminLogin />} />

          {/* Protected Routes: Must be authenticated to access */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<InventoryProvider><Layout /></InventoryProvider>}>
              <Route index element={<Inventory />} />
              <Route path="sales" element={<Sales />} />
              <Route path="receivables" element={<Receivables />} />
              <Route path="customers" element={<Customers />} />
              <Route path="settings" element={<Settings />} />
              <Route path="product/:id" element={<ProductForm />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

