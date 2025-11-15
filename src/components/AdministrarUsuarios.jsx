import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import { sanitizeText, sanitizeEmail } from "../utils/sanitize"; // ✅ Importación añadida

function AdministrarUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ nombre: "", email: "", contrasena: "", rol: "Recepcion" });
  const [editandoId, setEditandoId] = useState(null);
  const [cargando, setCargando] = useState(false);

  // ✅ Handler sanitizado para cambios en el formulario
  const manejarCambio = (e) => {
    const { name, value } = e.target;
    let valorLimpio = value;

    // Sanitizar según el tipo de campo
    if (name === 'email') {
      valorLimpio = sanitizeEmail(value);
    } else if (name === 'nombre' || name === 'rol') {
      valorLimpio = sanitizeText(value);
    } else if (name === 'contrasena') {
      valorLimpio = value; // Las contraseñas no se sanitizan para no afectar caracteres especiales
    }

    setForm({ ...form, [name]: valorLimpio });
  };

  // Cargar usuarios desde la base de datos al montar el componente
  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setCargando(true);
    const { data, error } = await supabase.from("infousuario").select("id, nombre, rol, activo");
    if (!error) {
      // ✅ Sanitizar los datos de usuarios
      const usuariosLimpios = data.map(usuario => ({
        ...usuario,
        nombre: sanitizeText(usuario.nombre),
        rol: sanitizeText(usuario.rol)
      }));
      setUsuarios(usuariosLimpios || []);
    }
    setCargando(false);
  };

  const validarFormulario = () => {
    const errors = [];
    
    if (!form.nombre.trim()) errors.push("El nombre es requerido");
    if (!form.email.trim() && !editandoId) errors.push("El email es requerido");
    if (!form.contrasena && !editandoId) errors.push("La contraseña es requerida");
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errors.push("Email inválido, formato correcto: ejemplo@ejemplo.com");
    if (form.contrasena && form.contrasena.length < 6) errors.push("La contraseña debe tener al menos 6 caracteres");
    
    return errors;
  };

  const guardarUsuario = async () => {
    const errores = validarFormulario();
    if (errores.length > 0) {
      toast.error(errores.join("\n"));
      return;
    }
    if (!form.nombre || !form.rol) return;
    setCargando(true);

    // ✅ Sanitizar datos antes de enviar
    const datosLimpios = {
      nombre: sanitizeText(form.nombre),
      email: sanitizeEmail(form.email),
      contrasena: form.contrasena, // Contraseña no se sanitiza
      rol: sanitizeText(form.rol)
    };

    if (editandoId !== null) {
      try {
        // 🔄 Lógica de actualizar usuario
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("No estás autenticado");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-auth`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              user_id: editandoId,
              email: datosLimpios.email || null,
              password: datosLimpios.contrasena || null,
              nombre: datosLimpios.nombre,
              rol: datosLimpios.rol,
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error al actualizar usuario");
        }

        await cargarUsuarios();
        setForm({ nombre: "", email: "", contrasena: "", rol: "Recepcion" });
        setEditandoId(null);
        setCargando(false);
      } catch (error) {
        toast.error("Error al actualizar usuario: " + error.message);
        setCargando(false);
      }

      return;
    } else {
      try {
        // ✅ Nueva lógica para crear usuario vía Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("No estás autenticado");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              email: datosLimpios.email,
              password: datosLimpios.contrasena,
              nombre: datosLimpios.nombre,
              rol: datosLimpios.rol,
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al crear usuario");

        await cargarUsuarios();
        setForm({ nombre: "", email: "", contrasena: "", rol: "Recepcion" });
        setEditandoId(null);
      } catch (err) {
        toast.error("Error al crear usuario: " + err.message);
      } finally {
        setCargando(false);
      }
    }
  };

  // Función para editar un usuario
  const editar = async (usuario) => {
    setCargando(true);

    try {
      // Obtener el token del usuario actual
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No estás autenticado");

      // Llamar a la función backend para obtener email
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lookup-user-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: usuario.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener email');
      }

      // ✅ Sanitizar datos antes de cargar en formulario
      setForm({
        nombre: sanitizeText(usuario.nombre),
        email: sanitizeEmail(data.email || ""),
        contrasena: "",
        rol: sanitizeText(usuario.rol),
      });

      setEditandoId(usuario.id);
    } catch (error) {
      toast.error("Error al cargar datos para edición: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  // Función para eliminar un usuario desde Edge Function Supabase
  const eliminar = async (id) => {
    const confirmar = window.confirm("¿Estás seguro de eliminar este usuario?");
    if (!confirmar) return;

    setCargando(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No estás autenticado");
      }

      // ✅ Ahora solo usamos la Edge Function
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-any-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: id }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar usuario");
      }

      // ✅ Refrescar lista
      await cargarUsuarios();

      // Limpiar formulario si estabas editando el usuario borrado
      if (editandoId === id) {
        setForm({ nombre: "", email: "", contrasena: "", rol: "Recepcion" });
        setEditandoId(null);
      }

      toast.success("Usuario eliminado correctamente");
    } catch (error) {
      console.error("Error eliminando usuario:", error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  const toggleActivo = async (id) => {
    const usuario = usuarios.find((u) => u.id === id);
    if (!usuario) return;
    const { error } = await supabase
      .from("infousuario")
      .update({ activo: !usuario.activo })
      .eq("id", id);
    if (!error) {
      await cargarUsuarios();
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
      }}
    >
      {/* Barra superior tipo "header" pero integrada */}
      <div className="flex items-center justify-between px-10 py-8">
        <button
          onClick={() => navigate("/recargados")}
          className="flex items-center text-emerald-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Volver
        </button>
        <h2 className="text-3xl font-extrabold text-white tracking-tight text-center flex-1 drop-shadow-lg">
          Administrar Usuarios
        </h2>|
        <img src="/LogoBlanco.png" alt="Logo Restaurante" className="w-36 h-20 object-contain drop-shadow" />
      </div>

      {/* Formulario de usuario */}
      <div className="w-full max-w-5xl mx-auto mb-8">
        <div className="bg-white/90 border border-emerald-300 rounded-2xl p-6 shadow-xl animate-slide-in-left">
          <h3 className="text-xl font-semibold mb-4 text-emerald-800">{editandoId ? "Editar Usuario" : "Nuevo Usuario"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={manejarCambio}
              placeholder="Nombre de usuario"
              className="border border-emerald-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-400 transition bg-emerald-50"
              disabled={cargando}
            />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={manejarCambio}
              placeholder="Correo: ejem@ejem.com"
              className="border border-emerald-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-400 transition bg-emerald-50"
              disabled={cargando}
            />
            <input
              type="password"
              name="contrasena"
              value={form.contrasena}
              onChange={manejarCambio}
              placeholder={editandoId ? "Nueva contraseña (opcional)" : "Contraseña"}
              className="border border-emerald-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-400 transition bg-emerald-50"
              disabled={cargando}
            />
            <select
              name="rol"
              value={form.rol}
              onChange={manejarCambio}
              className="border border-emerald-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-emerald-400 transition bg-emerald-50"
              disabled={cargando}
            >
              <option>Recepcion</option>
              <option>Mesero</option>
              <option>Cocina</option>
              <option>Administracion</option>
            </select>
            <button
              onClick={guardarUsuario}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow font-bold transition flex items-center justify-center"
              disabled={cargando}
            >
              {cargando ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editandoId ? "Actualizando..." : "Agregando..."}
                </div>
              ) : (
                <>
                  {editandoId ? "Actualizar" : "Agregar"}
                  <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editandoId ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"} />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="flex-1 w-full px-4 pb-8">
        <div className="bg-white/90 border border-emerald-300 rounded-2xl shadow-xl overflow-hidden animate-slide-in-left mx-auto w-full">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-700">
                <tr>
                  <th className="p-4 text-left text-white text-lg font-bold">Nombre</th>
                  <th className="p-4 text-left text-white text-lg font-bold">Rol</th>
                  <th className="p-4 text-left text-white text-lg font-bold">Estado</th>
                  <th className="p-4 text-left text-white text-lg font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-8 text-lg">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        <span className="ml-3">Cargando usuarios...</span>
                      </div>
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-gray-400 py-8 text-lg">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-16 h-16 text-emerald-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No hay usuarios registrados.</p>
                        <p className="text-sm mt-2">Comienza agregando un nuevo usuario con el formulario superior.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u, index) => (
                    <tr key={u.id} className={`transition ${index % 2 === 0 ? 'bg-emerald-50' : 'bg-white'} hover:bg-emerald-100`}>
                      <td className="p-4 font-medium text-gray-800">{u.nombre}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full font-semibold text-sm ${
                          u.rol === 'Recepcion' ? 'bg-purple-200 text-purple-800' : 
                          u.rol === 'Mesero' ? 'bg-blue-200 text-blue-800' : 
                          'bg-amber-200 text-amber-800'
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full font-semibold text-sm flex items-center w-24 justify-center ${
                          u.activo ? "bg-green-100 text-green-800 border border-green-300" : "bg-red-100 text-red-800 border border-red-300"
                        }`}>
                          <span className={`h-2 w-2 rounded-full mr-2 ${u.activo ? "bg-green-500" : "bg-red-500"}`}></span>
                          {u.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleActivo(u.id)}
                            className={`flex items-center px-3 py-1.5 rounded shadow transition text-sm ${
                              u.activo 
                                ? "bg-amber-500 hover:bg-amber-600 text-white" 
                                : "bg-green-500 hover:bg-green-600 text-white"
                            }`}
                            disabled={cargando}
                            title={u.activo ? "Desactivar usuario" : "Activar usuario"}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={u.activo ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"} />
                            </svg>
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            onClick={() => editar(u)}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded shadow transition text-sm flex items-center"
                            disabled={cargando}
                            title="Editar usuario"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Editar
                          </button>
                          <button
                            onClick={() => eliminar(u.id)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded shadow transition text-sm flex items-center"
                            disabled={cargando}
                            title="Eliminar usuario"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdministrarUsuarios;
