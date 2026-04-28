/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, UploadCloud, LogOut, HardDrive, Image as ImageIcon } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Notas from "./pages/Notas";
import EmpresaDetails from "./pages/EmpresaDetails";
import Login from "./pages/Login";
import Armazenamento from "./pages/Armazenamento";
import { getToken, logout, getAuthHeaders } from "./lib/auth";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [storageBytes, setStorageBytes] = useState<number>(0);

  useEffect(() => {
    const token = getToken();
    if (token) {
      setIsAuthenticated(true);
      fetch('/api/storage', { headers: getAuthHeaders() })
        .then(res => res.json())
        .then(data => setStorageBytes(data.bytes || 0))
        .catch(console.error);
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      setIsAuthenticated(true);
      window.location.reload();
    }} />;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight text-blue-600 flex items-center gap-2">
            <UploadCloud className="w-6 h-6" />
            NFe Automator
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/empresas" icon={Building2} label="Empresas" />
          <NavItem to="/armazenamento" icon={HardDrive} label="Armazenamento" />
        </nav>
        
        {/* Storage Widget Start */}
        <div className="p-4 mx-4 mb-4 mt-auto rounded-xl border border-gray-100 bg-gray-50 shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Armazenamento</p>
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-gray-700">Espaço Usado <strong>{formatBytes(storageBytes)}</strong></span>
          </div>
          <NavLink
            to="/armazenamento"
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Galeria de Arquivos
          </NavLink>
        </div>
        {/* Storage Widget End */}

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetails />} />
          <Route path="/armazenamento" element={<Armazenamento />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
          isActive 
            ? "bg-blue-50 text-blue-700 font-medium" 
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      <Icon className="w-5 h-5" />
      {label}
    </NavLink>
  );
}
