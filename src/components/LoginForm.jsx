import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { sanitizeText, sanitizeEmail } from "../utils/sanitize"; // ✅ Importación añadida

function LoginForm() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");

  const manejarLogin = async (e) => {
    e.preventDefault();
    setError("");

    // ✅ Sanitizar el email antes de usarlo
    const emailLimpio = sanitizeEmail(usuario);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: emailLimpio, // ✅ Usar email sanitizado
      password: contrasena,
    });

    if (authError || !authData.user) {
      setError("Credenciales incorrectas");
      return;
    }

    // 🔹 Obtener token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError("Sesión inválida");
      return;
    }

    // 🔹 Llamar a la Edge Function
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login-check`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = await res.json();
    if (!res.ok) {
      setError(result.error || "Error al validar usuario");
      return;
    }

    // 🔹 Redirigir según rol
    switch (result.rol) {
      case "Recepcion":
        navigate("/recepcion");
        break;
      case "Mesero":
        navigate("/mesero");
        break;
      case "Cocina":
        navigate("/cocina");
        break;
        case "Administracion":
        navigate("/recargados");
        break;
      default:
        setError("Rol no reconocido");
    }
  };

  // ✅ Función para sanitizar inputs en tiempo real
  const handleUsuarioChange = (e) => {
    const valorLimpio = sanitizeEmail(e.target.value);
    setUsuario(valorLimpio);
  };

  const handleContrasenaChange = (e) => {
    const valorLimpio = sanitizeText(e.target.value);
    setContrasena(valorLimpio);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: "none" }}
    >
      <img
        src="/fondo.jpg"
        alt="Fondo"
        className="absolute inset-0 w-full h-full object-cover opacity-100 -z-10"
        style={{ pointerEvents: "none", filter: "brightness(0.5)" }}
      />
      <div className="bg-white text-verde rounded-2xl shadow-xl p-4 md:p-8 w-full max-w-md animate-fade-in relative z-10">
        <div className="text-center mb-6">
          <img
            src="/Logo.png"
            alt="Logo del Restaurante"
            className="mx-auto w-80 h-40 object-contain mb-4"
          />
          <h2 className="text-3xl font-bold">Login para Empleados</h2>
          <p className="text-sm text-gray-600">Sistema de pedidos para restaurante</p>
        </div>
        <form onSubmit={manejarLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Correo del empleado"
            value={usuario}
            onChange={handleUsuarioChange} // ✅ Usar handler sanitizador
            className="p-3 border border-verde rounded-lg focus:outline-none focus:ring-2 focus:ring-verde placeholder:text-gray-400"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={contrasena}
            onChange={handleContrasenaChange} // ✅ Usar handler sanitizador
            className="p-3 border border-verde rounded-lg focus:outline-none focus:ring-2 focus:ring-verde placeholder:text-gray-400"
          />
          {error && (
            <div className="text-sm text-red-600 text-center font-medium">{error}</div>
          )}
          <button
            type="submit"
            className="bg-verde text-white py-3 rounded-lg hover:bg-emerald-900 transition-all duration-200"
          >
            Iniciar sesión
          </button>
          <a href="#" className="text-sm text-rojo text-center hover:underline">
            ¿Olvidaste tu contraseña?
          </a>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
