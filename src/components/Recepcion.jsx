import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import { sanitizeText, sanitizeHtmlReportes } from "../utils/sanitize"; // ✅ Importación añadida

function Recepcion() {
  const navigate = useNavigate();
  const [pedidosRecargados, setPedidosRecargados] = useState([]);
  const [pedidosFacturar, setPedidosFacturar] = useState([]);
  const [modalDetalle, setModalDetalle] = useState({ visible: false, pedido: null, anim: "in" });
  const [reportesRecibidos, setReportesRecibidos] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [usuarioRecepcion, setUsuarioRecepcion] = useState(null);
  const [idReporte, setIdReporte] = useState("");
  const [modalDetalleReporte, setModalDetalleReporte] = useState({ 
    visible: false, 
    pedido: null, 
    anim: "in" 
  });
  const [filtroHabitacion, setFiltroHabitacion] = useState(""); // Nuevo estado para filtro

  // ✅ Handler sanitizado para idReporte
  const handleIdReporteChange = (e) => {
    const valorLimpio = sanitizeText(e.target.value);
    setIdReporte(valorLimpio);
  };

  // ✅ Handler sanitizado para mensaje (si se usa en otros lugares)
  const setMensajeLimpio = (mensaje) => {
    const mensajeLimpio = sanitizeText(mensaje);
    setMensaje(mensajeLimpio);
  };

  // Función para obtener fecha y hora de Guatemala
  const getFechaHoraGuatemala = () => {
    const ahora = new Date();
    const ahoraGT = new Date(ahora.getTime() - (6 * 60 * 60 * 1000));
    const fecha = ahoraGT.toISOString().split('T')[0];
    const horas = String(ahoraGT.getUTCHours()).padStart(2, '0');
    const minutos = String(ahoraGT.getUTCMinutes()).padStart(2, '0');
    const segundos = String(ahoraGT.getUTCSeconds()).padStart(2, '0');
    return { fecha, hora: `${horas}:${minutos}:${segundos}` };
  };

  // Obtener información del usuario recepcionista
  useEffect(() => {
    const obtenerUsuario = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: usuarioInfo } = await supabase
            .from('infousuario')
            .select('nombre')
            .eq('id', user.id)
            .single();
          
          // ✅ Sanitizar nombre de usuario
          const nombreLimpio = usuarioInfo?.nombre ? sanitizeText(usuarioInfo.nombre) : "Recepcionista";
          setUsuarioRecepcion(nombreLimpio);
        }
      } catch (error) {
        console.error("Error obteniendo usuario:", error);
        setUsuarioRecepcion("Recepcionista");
      }
    };

    obtenerUsuario();
  }, []);

  // Cargar pedidos desde Supabase
  const cargarPedidos = async () => {
    try {
      setCargando(true);

      // Cargar pedidos recargados
      const { data: recargosData, error: recargosError } = await supabase
        .from("pedidos_recargados")
        .select(`
          id,
          habitacion,
          detalle_pedido,
          mesero,
          total,
          pedido_id
        `);

      if (recargosError) throw recargosError;

      const recargosFormateados = recargosData.map((item) => ({
        id: item.pedido_id,
        pedido_id: item.pedido_id,
        habitacion: sanitizeText(item.habitacion), // ✅ Sanitizado
        total: item.total,
        mesero: sanitizeText(item.mesero), // ✅ Sanitizado
        detalle: item.detalle_pedido,
        tipo: "recargado",
      }));

      // Cargar facturas
      const { data: facturasData, error: facturasError } = await supabase
        .from("facturas")
        .select(`
          id,
          nit,
          total,
          detalle_pedido,
          pedido_id,
          fecha
        `)
        .eq('facturado', false);

      if (facturasError) throw facturasError;

      const facturasFormateadas = facturasData.map((item) => ({
        id: item.id,
        pedido_id: item.pedido_id,
        total: item.total,
        nit: sanitizeText(item.nit), // ✅ Sanitizado
        detalle: item.detalle_pedido,
        fecha: item.fecha,
        tipo: "factura",
      }));

      setPedidosRecargados(recargosFormateados);
      setPedidosFacturar(facturasFormateadas);
    } catch (error) {
      console.error("Error cargando pedidos:", error);
      toast.error("Error al cargar los pedidos: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  // Función para cargar reportes - por ID en lugar de fecha
  const fetchReportes = async (filtroId = null) => {
    try {
      let query = supabase
        .from("reportes_enviados")
        .select("*");

      // Si hay filtro por ID
      if (filtroId) {
        query = query.eq("id", filtroId);
      } else {
        // Mostrar solo el último reporte por created_at si no hay filtro
        query = query.order("created_at", { ascending: false }).limit(1);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error cargando reportes:", error);
      } else {
        setReportesRecibidos(data || []);
      }
    } catch (error) {
      console.error("Error en fetchReportes:", error);
    }
  };

  // Manejo de búsqueda por ID
  const handleBuscarPorId = () => {
    if (!idReporte.trim()) {
      toast("Por favor ingresa un ID de reporte");
      return;
    }

    fetchReportes(idReporte.trim());
  };

  const limpiarFiltroId = () => {
    setIdReporte("");
    fetchReportes();
  };

  // Función para imprimir reporte
  const imprimirReporte = (reporteId) => {
    const elementoImpresion = document.getElementById(`reporte-impresion-${reporteId}`);
    
    if (!elementoImpresion) {
      toast.error("No se puede encontrar el contenido para imprimir");
      return;
    }

    const ventanaImpresion = window.open('', '_blank');
    ventanaImpresion.document.write(`
      <html>
        <head>
          <title>Reporte ${reporteId}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px;
              color: #000;
            }
            .encabezado {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .detalle-pedido {
              margin-top: 15px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
            }
            .total {
              font-weight: bold;
              margin-top: 10px;
            }
            @media print {
              body { 
                margin: 0;
                padding: 15px;
              }
            }
          </style>
        </head>
        <body>
          ${elementoImpresion.innerHTML}
        </body>
      </html>
    `);
    
    ventanaImpresion.document.close();
    
    // Esperar a que se cargue el contenido antes de imprimir
    setTimeout(() => {
      ventanaImpresion.print();
      // ventanaImpresion.close(); // Opcional: cerrar después de imprimir
    }, 250);
  };

  // Configurar suscripciones en tiempo real
  useEffect(() => {
    cargarPedidos();
    fetchReportes();

    // Suscribirse a cambios en pedidos_recargados
    const subscriptionRecargados = supabase
      .channel('pedidos_recargados_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'pedidos_recargados' 
        }, 
        () => {
          supabase
            .from("pedidos_recargados")
            .select(`
              id,
              habitacion,
              detalle_pedido,
              mesero,
              total,
              pedido_id
            `)
            .then(({ data, error }) => {
              if (!error && data) {
                const recargosFormateados = data.map((item) => ({
                  id: item.id,
                  pedido_id: item.pedido_id,
                  habitacion: sanitizeText(item.habitacion), // ✅ Sanitizado
                  total: item.total,
                  mesero: sanitizeText(item.mesero), // ✅ Sanitizado
                  detalle: item.detalle_pedido,
                  tipo: "recargado",
                }));
                setPedidosRecargados(recargosFormateados);
              }
            });
        }
      )
      .subscribe();

    // Suscribirse a cambios en facturas
    const subscriptionFacturas = supabase
      .channel('facturas_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'facturas' 
        }, 
        () => {
          supabase
            .from("facturas")
            .select(`
              id,
              nit,
              total,
              detalle_pedido,
              pedido_id,
              fecha
            `)
            .eq('facturado', false)
            .then(({ data, error }) => {
              if (!error && data) {
                const facturasFormateadas = data.map((item) => ({
                  id: item.id,
                  pedido_id: item.pedido_id,
                  total: item.total,
                  nit: sanitizeText(item.nit), // ✅ Sanitizado
                  detalle: item.detalle_pedido,
                  fecha: item.fecha,
                  tipo: "factura",
                }));
                setPedidosFacturar(facturasFormateadas);
              }
            });
        }
      )
      .subscribe();

    // Suscripción en tiempo real para reportes
    const channelReportes = supabase
      .channel('reportes-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reportes_enviados' },
        () => {
          // Si hay un filtro activo, mantenerlo
          if (idReporte) {
            handleBuscarPorId();
          } else {
            fetchReportes();
          }
        }
      )
      .subscribe();

    // Limpiar suscripciones al desmontar el componente
    return () => {
      supabase.removeChannel(subscriptionRecargados);
      supabase.removeChannel(subscriptionFacturas);
      supabase.removeChannel(channelReportes);
    };
  }, []);

  // Función para mostrar el modal de detalle
  const mostrarDetalle = (pedido) => {
    setModalDetalle({ visible: true, pedido: pedido, anim: "in" });
  };

  // Función para cerrar el modal de detalle con animación
  const cerrarModalDetalle = () => {
    setModalDetalle((prev) => ({ ...prev, anim: "out" }));
    setTimeout(() => setModalDetalle({ visible: false, pedido: null, anim: "in" }), 300);
  };

  // Función para cobrar pedido recargado (CON FECHA GT)
  const cobrarPedido = async (pedidoRecargadoId, metodoPago) => {
    try {
      const { data: pedidoRecargado, error: errorRecargado } = await supabase
        .from("pedidos_recargados")
        .select(`
          *,
          pedidos (*)
        `)
        .eq("pedido_id", pedidoRecargadoId)
        .single();

      if (errorRecargado) throw errorRecargado;

      if (!pedidoRecargado || !pedidoRecargado.pedidos) {
        throw new Error("No se encontró el pedido recargado");
      }

      const pedidoOriginal = pedidoRecargado.pedidos;
      // Usar fecha y hora de Guatemala
      const { fecha, hora } = getFechaHoraGuatemala();

      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          terminado: true,
          metodo_pago: sanitizeText(metodoPago), // ✅ Sanitizado
          numero: sanitizeText(pedidoRecargado.habitacion), // ✅ Sanitizado
          fecha: fecha,
          hora: hora,
          mesero: `${sanitizeText(pedidoRecargado.mesero)}/${usuarioRecepcion}` // ✅ Sanitizado
        })
        .eq("id", pedidoOriginal.id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from("pedidos_recargados")
        .delete()
        .eq("id", pedidoRecargadoId);

      if (deleteError) throw deleteError;

      setMensajeLimpio(`Pedido ${pedidoRecargadoId} cobrado con ${metodoPago}.`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error) {
      console.error("Error al cobrar pedido:", error);
      toast.error("Error al procesar el cobro: " + error.message);
    }
  };

  // Función para marcar factura como facturada (CON FECHA GT)
  const facturarPedido = async (id) => {
    try {
      // Usar fecha de Guatemala
      const { fecha } = getFechaHoraGuatemala();

      const { error } = await supabase
        .from("facturas")
        .update({ 
          facturado: true, 
          fecha: fecha
        })
        .eq("id", id);

      if (error) throw error;

      setMensajeLimpio(`Factura ${id} marcada como facturada.`);
      setTimeout(() => setMensaje(""), 2000);
    } catch (error) {
      console.error("Error al facturar:", error);
      toast.error("Error al procesar la factura: " + error.message);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión: " + error.message);
      return;
    }
    navigate("/");
  };

  // Función para formatear el detalle del pedido
  const formatearDetalle = (detalle) => {
    try {
      if (!detalle) return "Sin detalles";

      // Si viene como string, intentamos parsearlo
      if (typeof detalle === "string") {
        try {
          detalle = JSON.parse(detalle);
        } catch {
          return sanitizeText(detalle); // ✅ Sanitizado si no se puede parsear
        }
      }

      // Si es array (ej. [{ nombre: "Pizza", cantidad: 2 }, ...])
      if (Array.isArray(detalle)) {
        return detalle
          .map((item) => `${sanitizeText(item.nombre) || "Producto"} x${item.cantidad || 1}`)
          .join("\n");
      }

      // Si es objeto único
      if (typeof detalle === "object") {
        return `${sanitizeText(detalle.nombre) || "Producto"} x${detalle.cantidad || 1}`;
      }

      return sanitizeText(detalle); // ✅ Sanitizado
    } catch (e) {
      return "No se puede mostrar el detalle";
    }
  };
  
  // Función para mostrar detalle de pedido en reporte
  const mostrarDetalleReporte = (pedido) => {
    setModalDetalleReporte({ visible: true, pedido: pedido, anim: "in" });
  };

  // Función para cerrar el modal de detalle de reporte
  const cerrarModalDetalleReporte = () => {
    setModalDetalleReporte((prev) => ({ ...prev, anim: "out" }));
    setTimeout(() => setModalDetalleReporte({ visible: false, pedido: null, anim: "in" }), 300);
  };

  // Función para extraer pedidos del reporte
  const obtenerPedidosDeReporte = (reporte) => {
    if (reporte.datos_reportes && Array.isArray(reporte.datos_reportes)) {
      return reporte.datos_reportes;
    }
    return [];
  };

  // Función para formatear items de pedido (similar a formatearDetalle pero para items)
  const formatearItemsPedido = (items) => {
    try {
      if (!items) return "Sin items";
      let arr = items;
      // Si es string, intenta parsear a array
      if (typeof arr === "string") {
        try {
          arr = JSON.parse(arr);
        } catch {
          return "Formato de items inválido";
        }
      }
      if (!Array.isArray(arr)) return "Sin items";
      return arr.map(item =>
        `${item.cantidad || 1} × ${sanitizeText(item.nombre)} - Q${((item.precio || 0) * (item.cantidad || 1)).toFixed(2)}${item.nota ? `\nNota: ${item.nota}` : ""}`
      ).join('\n');
    } catch (error) {
      console.error("Error formateando items:", error);
      return "Error al mostrar items";
    }
  };

  // Handler para el filtro de habitación
  const handleFiltroHabitacion = (e) => {
    setFiltroHabitacion(sanitizeText(e.target.value));
  };

  // Filtrar pedidos recargados por habitación
  const pedidosRecargadosFiltrados = pedidosRecargados.filter(p =>
    filtroHabitacion.trim() === "" ||
    (p.habitacion && p.habitacion.toLowerCase().includes(filtroHabitacion.trim().toLowerCase()))
  );

  // 1. Solicitar permiso de notificación
  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);

  // 2. Función para mostrar notificación
  function mostrarNotificacion(titulo, cuerpo) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(titulo, {
        body: cuerpo,
        icon: "/LogoBlanco.png",
        vibrate: [200, 100, 200],
        tag: "pedido-nuevo"
      });
    }
  }

  // 3. Detectar nuevos pedidos recargados y facturas
  const prevRecargados = useRef(0);
  const prevFacturas = useRef(0);

  useEffect(() => {
    if (pedidosRecargados.length > prevRecargados.current) {
      mostrarNotificacion(
        "Nuevo pedido recargado",
        "¡Hay un nuevo pedido recargado pendiente de cobro!"
      );
    }
    prevRecargados.current = pedidosRecargados.length;
  }, [pedidosRecargados]);

  useEffect(() => {
    if (pedidosFacturar.length > prevFacturas.current) {
      mostrarNotificacion(
        "Nuevo pedido a facturar",
        "¡Hay un nuevo pedido pendiente de facturación!"
      );
    }
    prevFacturas.current = pedidosFacturar.length;
  }, [pedidosFacturar]);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{
        background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
      }}>
        <div className="text-white text-xl">Cargando pedidos...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
      }}
    >
      {/* Logo y título integrados al fondo */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <img
          src="/LogoBlanco.png"
          alt="Logo Restaurante"
          className="w-36 h-20 object-contain drop-shadow"
        />
        <h1 className="text-3xl font-extrabold text-emerald-300 tracking-tight text-center drop-shadow-lg flex-1 text-center">
          Recepción - Control de Pedidos
        </h1>
        {/* Botón Administrar Usuarios */}
        <button
          onClick={() => navigate("/usuarios")}
          className="flex items-center text-emerald-300 hover:text-white transition-colors"
        >
          Administrar Usuarios
        </button>

        <button
          onClick={() => navigate("/platos")}
          className="flex items-center text-emerald-300 hover:text-white transition-colors ml-4"
        >
          Administrar Platos
        </button>
  

        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="text-white hover:text-red-400 transition p-1 rounded ml-4"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
            />
          </svg>
        </button>
      </div>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
        {mensaje && (
          <div className="mb-6 text-center animate-fade-in">
            <span className="bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl shadow font-bold border border-emerald-200">{mensaje}</span>
          </div>
        )}

        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl text-blue-100">💳</span>
            <h2 className="text-2xl font-bold text-white">Pedidos Recargados</h2>
          </div>
          {/* Recuadro de búsqueda por habitación */}
          <div className="mb-4 flex items-center gap-3">
            <label htmlFor="filtroHabitacion" className="text-blue-100 font-medium">
              Buscar por habitación:
            </label>
            <input
              id="filtroHabitacion"
              type="text"
              value={filtroHabitacion}
              onChange={handleFiltroHabitacion}
              placeholder="Ej: 101"
              className="px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {filtroHabitacion && (
              <button
                onClick={() => setFiltroHabitacion("")}
                className="ml-2 px-3 py-2 rounded bg-gray-400 text-white hover:bg-gray-600"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="bg-white/80 rounded-2xl shadow border border-blue-100 p-0 overflow-x-auto animate-slide-in-left">
            {pedidosRecargadosFiltrados.length === 0 ? (
              <p className="text-blue-400 text-center py-10">No hay pedidos recargados pendientes de cobro.</p>
            ) : (
              <table className="w-full text-blue-900">
                <thead>
                  <tr className="bg-blue-50 border-b">
                    <th className="py-3 px-4 text-left font-semibold">ID</th>
                    <th className="py-3 px-4 text-left font-semibold">Habitación</th>
                    <th className="py-3 px-4 text-left font-semibold">Mesero</th>
                    <th className="py-3 px-4 text-left font-semibold">Detalle</th>
                    <th className="py-3 px-4 text-left font-semibold">Total</th>
                    <th className="py-3 px-4 text-left font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosRecargadosFiltrados.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-blue-100/40 transition">
                      <td className="py-3 px-4">{pedido.id}</td>
                      <td className="py-3 px-4">{pedido.habitacion}</td>
                      {/* Cambia aquí: muestra el mesero de pedidos_recargados */}
                      <td className="py-3 px-4">{pedido.mesero}</td>
                      <td className="py-3 px-4">
                        <button
                          className="bg-emerald-500 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg shadow transition text-sm"
                          onClick={() => mostrarDetalle(pedido)}
                        >
                          Ver detalle
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold">Q {pedido.total.toFixed(2)}</td>
                      <td className="py-3 px-4 flex gap-2">
                        <button
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded-lg shadow transition text-sm"
                          onClick={() => cobrarPedido(pedido.id, "efectivo")}
                        >
                          Cobrar efectivo
                        </button>
                        <button
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-lg shadow transition text-sm"
                          onClick={() => cobrarPedido(pedido.id, "tarjeta")}
                        >
                          Cobrar tarjeta
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl text-amber-100">🧾</span>
            <h2 className="text-2xl font-bold text-white">Pedidos a Facturar</h2>
          </div>
          <div className="bg-white/80 rounded-2xl shadow border border-amber-100 p-0 overflow-x-auto animate-slide-in-left">
            {pedidosFacturar.length === 0 ? (
              <p className="text-amber-400 text-center py-10">No hay pedidos pendientes de facturación.</p>
            ) : (
              <table className="w-full text-amber-900">
                <thead>
                  <tr className="bg-amber-50 border-b">
                    <th className="py-3 px-4 text-left font-semibold">ID Factura</th>
                    <th className="py-3 px-4 text-left font-semibold">ID Pedido</th>
                    <th className="py-3 px-4 text-left font-semibold">Detalle</th>
                    <th className="py-3 px-4 text-left font-semibold">Total</th>
                    <th className="py-3 px-4 text-left font-semibold">NIT</th>
                    <th className="py-3 px-4 text-left font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosFacturar.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-amber-100/40 transition">
                      <td className="py-3 px-4">{pedido.id}</td>
                      <td className="py-3 px-4">{pedido.pedido_id}</td>
                      <td className="py-3 px-4">
                        <button
                          className="bg-emerald-500 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg shadow transition text-sm"
                          onClick={() => mostrarDetalle(pedido)}
                        >
                          Ver detalle
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold">Q {pedido.total.toFixed(2)}</td>
                      <td className="py-3 px-4">{pedido.nit}</td>
                      <td className="py-3 px-4">
                        <button
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1 rounded-lg shadow transition text-sm"
                          onClick={() => facturarPedido(pedido.id)}
                        >
                          Marcar como facturado
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="mb-6 mt-12">
          <h3 className="text-xl font-bold mb-3 text-white">📊 Reportes Recibidos</h3>
          
          {/* Filtro por ID único de texto */}
          <div className="mb-4 flex items-center gap-4 flex-wrap">
            <label htmlFor="idReporte" className="text-white font-medium">
              Buscar por ID de Reporte:
            </label>
            <input
              type="text"
              id="idReporte"
              value={idReporte}
              onChange={handleIdReporteChange} // ✅ Handler sanitizado
              className="px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ingresa el ID del reporte"
            />
            <button
              onClick={handleBuscarPorId}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition"
              disabled={!idReporte.trim()}
            >
              Buscar
            </button>
            {idReporte && (
              <button
                onClick={limpiarFiltroId}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
              >
                Limpiar filtro
              </button>
            )}
          </div>
          
          {reportesRecibidos.length === 0 ? (
            <p className="text-gray-300">
              {idReporte 
              ? `No hay reportes con ID "${idReporte}"`
              : "No hay reportes recibidos"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reportesRecibidos.map((reporte, idx) => (
                <div key={reporte.id} className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-6 rounded-2xl shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-yellow-400">Reporte ID: {reporte.id}</h4>
                    <span className="text-sm text-gray-400">
                      {new Date(reporte.created_at).toLocaleString('es-GT')}
                    </span>
                  </div>

                  {/* BOTÓN IMPRIMIR CON ICONO DE IMPRESORA Y TOOLTIP */}
                  <div className="mb-4 flex justify-end">
                    <div className="relative group">
                      <button
                        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg font-bold shadow transition flex items-center"
                        onClick={() => imprimirReporte(reporte.id)}
                        title="Imprimir reporte"
                      >
                        {/* Icono de impresora */}
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            strokeWidth={2} 
                            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m4 4h6a2 2 0 002-2v-4a2 2 0 00-2-2h-6a2 2 0 00-2 2v4a2 2 0 002 2zM7 7h10v4H7V7z" 
                          />
                        </svg>
                      </button>
                      {/* Tooltip que aparece al pasar el mouse */}
                      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        Imprimir
                      </span>
                    </div>
                  </div>

                  {/* CONTENIDO DEL REPORTE PARA IMPRIMIR */}
                  <div id={`reporte-impresion-${reporte.id}`}>
                    {reporte.formato_especial && reporte.reporte_html ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlReportes(reporte.reporte_html) }} />  // ✅ Sanitizado
                    ) : (
                      <>
                        <div className="text-center mb-6">
                          <h2 className="text-2xl font-bold text-yellow-400 mb-2">REPORTE DE VENTAS</h2>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div className="bg-gray-700 p-2 rounded">
                              <span className="font-semibold text-yellow-300">Fecha:</span> {reporte.fecha}
                            </div>
                            <div className="bg-gray-700 p-2 rounded">
                              <span className="font-semibold text-yellow-300">Turno:</span> {reporte.turno}
                            </div>
                            <div className="bg-gray-700 p-2 rounded">
                              <span className="font-semibold text-yellow-300">Total Pedidos:</span> {reporte.total_pedidos}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-300 mt-4">
                          Enviado por: {reporte.mesero_recepcionista || 'Sistema'}
                        </div>
                      </>
                    )}
                  </div>

                  {reporte.datos_reportes && Array.isArray(reporte.datos_reportes) && (
                    <div className="mt-4">
                      <h4 className="text-lg font-bold text-yellow-400 mb-2">Detalles de Pedidos</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-600 text-sm">
                          <thead>
                            <tr className="bg-gray-700">
                              <th className="p-2 border border-gray-600 font-semibold">ID Pedido</th>
                              <th className="p-2 border border-gray-600 font-semibold">Total</th>
                              <th className="p-2 border border-gray-600 font-semibold">Método Pago</th>
                              <th className="p-2 border border-gray-600 font-semibold">Detalle</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reporte.datos_reportes.map((pedido) => (
                              <tr key={pedido.id} className="hover:bg-gray-700 border-b border-gray-600">
                                <td className="p-2 border border-gray-600 text-center">{pedido.id}</td>
                                <td className="p-2 border border-gray-600 text-center">Q{pedido.total?.toFixed(2) || '0.00'}</td>
                                <td className="p-2 border border-gray-600 text-center capitalize">{pedido.metodo_pago || '-'}</td>
                                <td className="p-2 border border-gray-600 text-center">
                                  <button
                                    onClick={() => mostrarDetalleReporte(pedido)}
                                    className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1 rounded text-xs"
                                  >
                                    Ver detalle
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Detalle Reporte */}
      {modalDetalleReporte.visible && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div
            className={`
              bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-4 border-blue-300
              ${modalDetalleReporte.anim === "in" ? "animate-zoom-in" : "animate-zoom-out"}
            `}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-700">Detalle del Pedido en Reporte</h2>
              <button
                onClick={cerrarModalDetalleReporte}
                className="text-xl text-gray-500 hover:text-blue-700 transition"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            
            {modalDetalleReporte.pedido && (
              <>
                <div className="mb-4">
                  <span className="font-semibold">ID Pedido:</span> {modalDetalleReporte.pedido.id}
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Habitación:</span> {modalDetalleReporte.pedido.habitacion}
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Mesero:</span> {modalDetalleReporte.pedido.mesero}
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Detalles:</span>
                  <div className="mt-2 bg-gray-100 p-3 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {formatearItemsPedido(modalDetalleReporte.pedido.items)}
                    </pre>
                  </div>
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Total:</span> Q {modalDetalleReporte.pedido.total?.toFixed(2)}
                </div>
              </>
            )}
            
            <div className="flex justify-end">
              <button
                onClick={cerrarModalDetalleReporte}
                className="bg-blue-500 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Pedido */}
      {modalDetalle.visible && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div
            className={`
              bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-4 border-emerald-300
              ${modalDetalle.anim === "in" ? "animate-zoom-in" : "animate-zoom-out"}
            `}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-emerald-700">Detalle del Pedido</h2>
              <button
                onClick={cerrarModalDetalle}
                className="text-xl text-gray-500 hover:text-emerald-700 transition"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
            
            {modalDetalle.pedido.tipo === "recargado" && (
              <>
                <div className="mb-4">
                  <span className="font-semibold">Habitación:</span> {modalDetalle.pedido.habitacion}
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Mesero:</span> {modalDetalle.pedido.mesero}
                </div>
              </>
            )}
            
            {modalDetalle.pedido.tipo === "factura" && (
              <div className="mb-4">
                <span className="font-semibold">NIT:</span> {modalDetalle.pedido.nit}
              </div>
            )}
            
            <div className="mb-4">
              <span className="font-semibold">Detalles:</span>
              <div className="mt-2 bg-gray-100 p-3 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {formatearDetalle(modalDetalle.pedido.detalle)}
                </pre>
              </div>
            </div>
            
            <div className="mb-4">
              <span className="font-semibold">Total:</span> Q {modalDetalle.pedido.total.toFixed(2)}
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={cerrarModalDetalle}
                className="bg-emerald-500 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold shadow transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default Recepcion;
