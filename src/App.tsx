/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Routes, Route, NavLink } from "react-router-dom";
import { LayoutDashboard, Building2, FileText, UploadCloud } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Notas from "./pages/Notas";
import EmpresaDetails from "./pages/EmpresaDetails";

export default function App() {
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
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:id" element={<EmpresaDetails />} />
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
