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
    <div className="flex h-screen bg-[#f5f7f9] font-sans text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e5e9f0] flex flex-col shadow-[2px_0_15px_rgba(0,0,0,0.02)] z-10">
        <div className="p-6">
          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-[#4a72ff]" />
            NFe Automator
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/empresas" icon={Building2} label="Empresas" />
        </nav>
        
        {/* Storage Widget Start */}
        <div className="p-4 mx-4 mb-4 mt-auto rounded-2xl border border-gray-100 bg-[#f8f9fc] shadow-sm relative overflow-hidden">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">Armazenamento</p>
          <div className="flex items-center gap-2 mb-4">
            <HardDrive className="w-4 h-4 text-[#4a72ff]" />
            <span className="text-sm text-gray-800 font-medium">Espaço Usado <strong>{formatBytes(storageBytes)}</strong></span>
          </div>
          <NavLink
            to="/armazenamento"
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#e8f1ff] text-[#1e5eff] rounded-xl text-sm font-semibold border border-[#d6e5ff] hover:bg-[#dce9ff] transition-colors shadow-sm"
          >
            <ImageIcon className="w-4 h-4" />
            Galeria de Arquivos
          </NavLink>
        </div>
        {/* Storage Widget End */}

        <div className="p-4">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
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
        `flex items-center gap-3 px-4 py-3 rounded-full transition-all ${
          isActive 
            ? "bg-[#eaf5ff] text-[#026aa2] font-semibold border border-[#7dd3fc] shadow-[0_0_15px_rgba(125,211,252,0.4)]" 
            : "text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900 border border-transparent"
        }`
      }
    >
      <Icon className="w-5 h-5" />
      {label}
    </NavLink>
  );
}
