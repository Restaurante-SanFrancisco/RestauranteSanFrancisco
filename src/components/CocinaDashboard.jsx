import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../supabaseClient";
import notificationSound from "../assets/sounds/notification.mp3";
import sinpedidos from "../assets/images/sinpedidos.png";
import { toast } from "react-hot-toast";

const MAX_ON_SCREEN = 3;

const CocinaDashboard = () => {
  const navigate = useNavigate();
  const [allPedidos, setAllPedidos] = useState([]);
  const [onScreenPedidos, setOnScreenPedidos] = useState([]);
  const audioRef = useRef(null);

  // Actualiza los pedidos en pantalla
  const updateOnScreenPedidos = (pedidos) => {
    setOnScreenPedidos(pedidos.slice(0, MAX_ON_SCREEN));
  };

  useEffect(() => {
    updateOnScreenPedidos(allPedidos);
  }, [allPedidos]);

  useEffect(() => {
    const cargarPedidos = async () => {
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("*")
          .eq("terminado", false)
          .order("id", { ascending: true });

        if (error) throw error;
        setAllPedidos(data || []);
      } catch (error) {
        console.error("Error cargando pedidos:", error);
      }
    };

    cargarPedidos();

    const subscription = supabase
      .channel("pedidos-cambios")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pedidos",
        },
        (payload) => {
          if (payload.new?.terminado === false) {
            audioRef.current?.play();
            setAllPedidos((prev) => {
              const existe = prev.some((p) => p.id === payload.new.id);

              if (payload.eventType === "INSERT" && !existe) {
                return [...prev, payload.new];
              }

              if (payload.eventType === "UPDATE") {
                if (payload.new.terminado) {
                  return prev.filter((p) => p.id !== payload.new.id);
                }
                return prev.map((p) =>
                  p.id === payload.new.id ? payload.new : p
                );
              }

              return prev;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const marcarTerminado = async (id) => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ terminado: true })
        .eq("id", id);

      if (error) throw error;

      // Eliminar el pedido completado de la lista
      setAllPedidos(prev => prev.filter(p => p.id !== id));
      
    } catch (error) {
      console.error("Error al marcar como terminado:", error);
      toast.error("Error al actualizar el estado del pedido");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
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

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
      }}
      dir="rtl"
    >
      <div className="flex items-center justify-between px-1 pt-1 pb-3">
        <img
          src="/LogoBlanco.png"
          alt="Logo Restaurante"
          className="w-36 h-20 object-contain drop-shadow"
        />     
        <h1 className="text-3xl font-bold mb-6 text-center text-green-100" dir="ltr">
        Pedidos Pendientes
        </h1>
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
      <audio ref={audioRef} src={notificationSound} preload="auto" />
      

      {allPedidos.length > MAX_ON_SCREEN && (
        <div className="text-center mb-4 text-yellow-300 font-semibold" dir="ltr">
          Pedidos en cola: {allPedidos.length - MAX_ON_SCREEN}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatePresence>
          {onScreenPedidos.map((pedido) => (
            <motion.div
              key={pedido.id}
              layout
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              transition={{ duration: 0.4 }}
              className="bg-white border-r-8 rounded-2xl shadow-lg p-5 relative"
              style={{
                borderColor: pedido.tipo === "mesa" ? "#16a34a" : "#2563eb",
              }}
              dir="ltr"
            >
              <div
                className="absolute top-3 right-3 text-xs font-semibold px-3 py-1 rounded-full text-white"
                style={{
                  backgroundColor: pedido.tipo === "mesa" ? "#16a34a" : "#2563eb",
                }}
              >
                {pedido.tipo.toUpperCase()}
              </div>

              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold">
                  {pedido.destino}
                  <span className="block text-sm text-gray-500">
                    Mesero: {pedido.mesero}
                  </span>
                </h2>
                <span className="text-xs text-gray-500">
                  {formatDate(pedido.creado_en)}
                </span>
              </div>

              <ul className="mb-4 space-y-2">
                {pedido.items.map((item, idx) => (
                  <li key={idx} className="bg-gray-100 rounded-md p-3">
                    <p className="font-medium text-gray-700">
                      {item.cantidad} × {item.nombre}
                    </p>
                    {item.opciones && item.opciones.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-500">
                        {item.opciones.map((op, i) => (
                          <li key={i}>
                            {op.opcion}: {op.valor}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.nota && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800 font-medium">Nota:</p>
                        <p className="text-sm text-yellow-700">{item.nota}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span className="text-green-700">Q{pedido.total}</span>
              </div>

              <button
                onClick={() => marcarTerminado(pedido.id)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold mt-4"
              >
                Marcar como Terminado
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {allPedidos.length === 0 && (
          <div className="flex flex-col items-center justify-center col-span-full mt-10 space-y-4" dir="ltr">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-2xl font-semibold text-blue-100"
            >
              🎉 ¡No hay pedidos pendientes! 🎉
            </motion.p>
            <motion.img
              src={sinpedidos}
              alt="No hay pedidos"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-80 h-80 object-contain"
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CocinaDashboard;