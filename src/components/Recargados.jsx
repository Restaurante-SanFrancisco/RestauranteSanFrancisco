import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import { sanitizeText } from "../utils/sanitize";

function Recargados() {
    const navigate = useNavigate();
    const [empleadosRecargados, setEmpleadosRecargados] = useState([]);
    const [eventosRecargados, setEventosRecargados] = useState([]);
    const [modalDetalle, setModalDetalle] = useState({ visible: false, pedido: null, anim: "in", tipo: "" });
    const [filtroEmpleado, setFiltroEmpleado] = useState("");
    const [filtroEvento, setFiltroEvento] = useState("");
    const [cargando, setCargando] = useState(true);

    // Función para cargar empleados recargados
    const cargarEmpleadosRecargados = async () => {
        try {
            const { data: empleadosData, error: empleadosError } = await supabase
                .from("empleados_recargados")
                .select(`
          id,
          empleado,
          detalle_pedido,
          mesero,
          total,
          pedido_id,
          fecha
        `);

            if (empleadosError) throw empleadosError;

            const empleadosFormateados = empleadosData.map((item) => ({
                id: item.id,
                pedido_id: item.pedido_id,
                empleado: sanitizeText(item.empleado),
                total: item.total,
                mesero: sanitizeText(item.mesero),
                detalle: item.detalle_pedido,
                fecha: item.fecha,
                tipo: "empleado_recargado",
            }));

            setEmpleadosRecargados(empleadosFormateados);
        } catch (error) {
            console.error("Error cargando empleados recargados:", error);
            toast.error("Error al cargar los empleados recargados: " + error.message);
        }
    };

    // Función para cargar eventos recargados
    const cargarEventosRecargados = async () => {
        try {
            const { data: eventosData, error: eventosError } = await supabase
                .from("eventos_recargados")
                .select(`
          id,
          evento,
          detalle_pedido,
          mesero,
          total,
          pedido_id,
          fecha
        `);

            if (eventosError) throw eventosError;

            const eventosFormateados = eventosData.map((item) => ({
                id: item.id,
                pedido_id: item.pedido_id,
                evento: sanitizeText(item.evento),
                total: item.total,
                mesero: sanitizeText(item.mesero),
                detalle: item.detalle_pedido,
                fecha: item.fecha,
                tipo: "evento_recargado",
            }));

            setEventosRecargados(eventosFormateados);
        } catch (error) {
            console.error("Error cargando eventos recargados:", error);
            toast.error("Error al cargar los eventos recargados: " + error.message);
        } finally {
            setCargando(false);
        }
    };

    // Cargar ambos tipos de recargados
    const cargarTodosLosRecargados = async () => {
        setCargando(true);
        await Promise.all([
            cargarEmpleadosRecargados(),
            cargarEventosRecargados()
        ]);
        setCargando(false);
    };

    // Configurar suscripciones en tiempo real
    useEffect(() => {
        cargarTodosLosRecargados();

        const subscriptionEmpleados = supabase
            .channel('empleados_recargados_changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'empleados_recargados'
                },
                () => {
                    cargarEmpleadosRecargados();
                }
            )
            .subscribe();

        const subscriptionEventos = supabase
            .channel('eventos_recargados_changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'eventos_recargados'
                },
                () => {
                    cargarEventosRecargados();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(subscriptionEmpleados);
            supabase.removeChannel(subscriptionEventos);
        };
    }, []);

    // Función para mostrar el modal de detalle
    const mostrarDetalle = (pedido, tipo) => {
        setModalDetalle({ visible: true, pedido: pedido, anim: "in", tipo });
    };

    // Función para cerrar el modal de detalle con animación
    const cerrarModalDetalle = () => {
        setModalDetalle((prev) => ({ ...prev, anim: "out" }));
        setTimeout(() => setModalDetalle({ visible: false, pedido: null, anim: "in", tipo: "" }), 300);
    };

    // Función para cobrar pedido de empleado
    const cobrarPedidoEmpleado = async (empleadoRecargadoId) => {
        try {
            const { error: deleteError } = await supabase
                .from("empleados_recargados")
                .delete()
                .eq("id", empleadoRecargadoId);

            if (deleteError) throw deleteError;

            toast.success("Pedido de empleado marcado como cobrado.");

        } catch (error) {
            console.error("Error al cobrar pedido de empleado:", error);
            toast.error("Error al procesar el cobro: " + error.message);
        }
    };

    // Función para cobrar pedido de evento
    const cobrarPedidoEvento = async (eventoRecargadoId) => {
        try {
            const { error: deleteError } = await supabase
                .from("eventos_recargados")
                .delete()
                .eq("id", eventoRecargadoId);

            if (deleteError) throw deleteError;

            toast.success("Pedido de evento marcado como cobrado.");

        } catch (error) {
            console.error("Error al cobrar pedido de evento:", error);
            toast.error("Error al procesar el cobro: " + error.message);
        }
    };

    // Función para formatear el detalle del pedido
    const formatearDetalle = (detalle) => {
        try {
            if (!detalle) return "Sin detalles";

            if (typeof detalle === "string") {
                try {
                    detalle = JSON.parse(detalle);
                } catch {
                    return sanitizeText(detalle);
                }
            }

            if (Array.isArray(detalle)) {
                return detalle
                    .map((item) => `${sanitizeText(item.nombre) || "Producto"} x${item.cantidad || 1}`)
                    .join("\n");
            }

            if (typeof detalle === "object") {
                return `${sanitizeText(detalle.nombre) || "Producto"} x${detalle.cantidad || 1}`;
            }

            return sanitizeText(detalle);
        } catch (e) {
            return "No se puede mostrar el detalle";
        }
    };

    // Handlers para los filtros
    const handleFiltroEmpleado = (e) => {
        setFiltroEmpleado(sanitizeText(e.target.value));
    };

    const handleFiltroEvento = (e) => {
        setFiltroEvento(sanitizeText(e.target.value));
    };

    // Filtrar empleados recargados por nombre
    const empleadosRecargadosFiltrados = empleadosRecargados.filter(p =>
        filtroEmpleado.trim() === "" ||
        (p.empleado && p.empleado.toLowerCase().includes(filtroEmpleado.trim().toLowerCase()))
    );

    // Filtrar eventos recargados por nombre de evento
    const eventosRecargadosFiltrados = eventosRecargados.filter(p =>
        filtroEvento.trim() === "" ||
        (p.evento && p.evento.toLowerCase().includes(filtroEvento.trim().toLowerCase()))
    );

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            toast.error("Error al cerrar sesión: " + error.message);
            return;
        }
        navigate("/");
    };

    if (cargando) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{
                background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
            }}>
                <div className="text-white text-xl">Cargando recargados...</div>
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
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/recepcion")}
                        className="flex items-center text-emerald-300 hover:text-white transition-colors font-medium"
                    >
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Volver a Recepción
                    </button>
                </div>

                <h1 className="text-3xl font-extrabold text-purple-300 tracking-tight text-center drop-shadow-lg flex-1 text-center">
                    Recargados
                </h1>

                <img
                    src="/LogoBlanco.png"
                    alt="Logo Restaurante"
                    className="w-36 h-20 object-contain drop-shadow"
                />
            </div>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">
                {/* SECCIÓN EVENTOS RECARGADOS */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl text-blue-100">🎉</span>
                        <h2 className="text-2xl font-bold text-white">Eventos Recargados</h2>
                    </div>

                    {/* Filtro por evento */}
                    <div className="mb-4 flex items-center gap-3">
                        <label htmlFor="filtroEvento" className="text-blue-100 font-medium">
                            Buscar por evento:
                        </label>
                        <input
                            id="filtroEvento"
                            type="text"
                            value={filtroEvento}
                            onChange={handleFiltroEvento}
                            placeholder="Ej: Conferencia Empresarial"
                            className="px-3 py-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {filtroEvento && (
                            <button
                                onClick={() => setFiltroEvento("")}
                                className="ml-2 px-3 py-2 rounded bg-gray-400 text-white hover:bg-gray-600"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <div className="bg-white/80 rounded-2xl shadow border border-blue-100 p-0 overflow-x-auto animate-slide-in-left">
                        {eventosRecargadosFiltrados.length === 0 ? (
                            <p className="text-blue-400 text-center py-10">No hay pedidos de eventos pendientes de cobro.</p>
                        ) : (
                            <table className="w-full text-blue-900">
                                <thead>
                                    <tr className="bg-blue-50 border-b">
                                        <th className="py-3 px-4 text-left font-semibold">ID Pedido</th>
                                        <th className="py-3 px-4 text-left font-semibold">Evento</th>
                                        <th className="py-3 px-4 text-left font-semibold">Fecha</th>
                                        <th className="py-3 px-4 text-left font-semibold">Mesero</th>
                                        <th className="py-3 px-4 text-left font-semibold">Total</th>
                                        <th className="py-3 px-4 text-left font-semibold">Detalle</th>
                                        <th className="py-3 px-4 text-left font-semibold">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {eventosRecargadosFiltrados.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-blue-100/40 transition">
                                            <td className="py-3 px-4">{pedido.pedido_id}</td>
                                            <td className="py-3 px-4">{pedido.evento}</td>
                                            <td className="py-3 px-4">{pedido.fecha}</td>
                                            <td className="py-3 px-4">{pedido.mesero}</td>
                                            <td className="py-3 px-4 font-bold">Q {pedido.total.toFixed(2)}</td>
                                            <td className="py-3 px-4">
                                                <button
                                                    className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded-lg shadow transition text-sm"
                                                    onClick={() => mostrarDetalle(pedido, "evento")}
                                                >
                                                    Ver detalle
                                                </button>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-lg shadow transition text-sm"
                                                    onClick={() => cobrarPedidoEvento(pedido.id)}
                                                >
                                                    Cobrado
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                {/* SECCIÓN EMPLEADOS RECARGADOS */}
                <section className="mb-12">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-2xl text-purple-100">👥</span>
                        <h2 className="text-2xl font-bold text-white">Empleados Recargados</h2>
                    </div>

                    {/* Filtro por empleado */}
                    <div className="mb-4 flex items-center gap-3">
                        <label htmlFor="filtroEmpleado" className="text-purple-100 font-medium">
                            Buscar por empleado:
                        </label>
                        <input
                            id="filtroEmpleado"
                            type="text"
                            value={filtroEmpleado}
                            onChange={handleFiltroEmpleado}
                            placeholder="Ej: Juan Pérez"
                            className="px-3 py-2 rounded-lg border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                        />
                        {filtroEmpleado && (
                            <button
                                onClick={() => setFiltroEmpleado("")}
                                className="ml-2 px-3 py-2 rounded bg-gray-400 text-white hover:bg-gray-600"
                            >
                                Limpiar
                            </button>
                        )}
                    </div>

                    <div className="bg-white/80 rounded-2xl shadow border border-purple-100 p-0 overflow-x-auto animate-slide-in-left">
                        {empleadosRecargadosFiltrados.length === 0 ? (
                            <p className="text-purple-400 text-center py-10">No hay pedidos de empleados pendientes de cobro.</p>
                        ) : (
                            <table className="w-full text-purple-900">
                                <thead>
                                    <tr className="bg-purple-50 border-b">
                                        <th className="py-3 px-4 text-left font-semibold">ID Pedido</th>
                                        <th className="py-3 px-4 text-left font-semibold">Empleado</th>
                                        <th className="py-3 px-4 text-left font-semibold">Fecha</th>
                                        <th className="py-3 px-4 text-left font-semibold">Mesero</th>
                                        <th className="py-3 px-4 text-left font-semibold">Total</th>
                                        <th className="py-3 px-4 text-left font-semibold">Detalle</th>
                                        <th className="py-3 px-4 text-left font-semibold">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {empleadosRecargadosFiltrados.map((pedido) => (
                                        <tr key={pedido.id} className="hover:bg-purple-100/40 transition">
                                            <td className="py-3 px-4">{pedido.pedido_id}</td>
                                            <td className="py-3 px-4">{pedido.empleado}</td>
                                            <td className="py-3 px-4">{pedido.fecha}</td>
                                            <td className="py-3 px-4">{pedido.mesero}</td>
                                            <td className="py-3 px-4 font-bold">Q {pedido.total.toFixed(2)}</td>
                                            <td className="py-3 px-4">
                                                <button
                                                    className="bg-emerald-500 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg shadow transition text-sm"
                                                    onClick={() => mostrarDetalle(pedido, "empleado")}
                                                >
                                                    Ver detalle
                                                </button>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-1 rounded-lg shadow transition text-sm"
                                                    onClick={() => cobrarPedidoEmpleado(pedido.id)}
                                                >
                                                    Cobrado
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </main>

            {/* Modal Detalle Pedido */}
            {modalDetalle.visible && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div
                        className={`
              bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full border-4 ${modalDetalle.tipo === "evento" ? "border-blue-300" : "border-emerald-300"
                            }
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

                        {modalDetalle.pedido && (
                            <>
                                <div className="mb-4">
                                    <span className="font-semibold">
                                        {modalDetalle.tipo === "evento" ? "Evento:" : "Empleado:"}
                                    </span> {modalDetalle.tipo === "evento" ? modalDetalle.pedido.evento : modalDetalle.pedido.empleado}
                                </div>
                                <div className="mb-4">
                                    <span className="font-semibold">Mesero:</span> {modalDetalle.pedido.mesero}
                                </div>
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
                            </>
                        )}

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

export default Recargados;
