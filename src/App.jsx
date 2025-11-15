import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "./components/LoginForm";
import Recepcion from "./components/Recepcion";
import MeseroPanel from "./components/MeseroPanel";
import CocinaDashboard from "./components/CocinaDashboard";
import AdministrarUsuarios from "./components/AdministrarUsuarios"; 
import AdministracionPlatos from "./components/administracionPlatillos";
import Recargados from "./components/Recargados";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster, toast } from 'react-hot-toast';


function App() {
  return (
    
    <Router>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<LoginForm />} />

        {/* Rutas protegidas con roles específicos */}
        <Route 
          path="/recepcion" 
          element={
            <ProtectedRoute allowedRoles={['recepcion']}>
              <Recepcion />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/mesero" 
          element={
            <ProtectedRoute allowedRoles={['mesero']}>
              <MeseroPanel />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cocina" 
          element={
            <ProtectedRoute allowedRoles={['cocina']}>
              <CocinaDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/usuarios" 
          element={
            <ProtectedRoute allowedRoles={['administracion']}> 
              <AdministrarUsuarios />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/platos" 
          element={
            <ProtectedRoute allowedRoles={['administracion']}> 
              <AdministracionPlatos />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recargados" 
          element={
            <ProtectedRoute allowedRoles={['administracion']}> 
              <Recargados />
            </ProtectedRoute>
          } 
        />

        {/* Ruta por defecto para redireccionar si intentan acceder a una ruta inexistente */}
        <Route path="*" element={<Navigate to="/" path/>} />
      </Routes>
      
      <Toaster position="bottom-right" />
    </Router>
    
  );
}

export default App;
