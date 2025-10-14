import { useState, useEffect } from "react";
import { sanitizeText, sanitizeNumber } from "../utils/sanitize";
import { supabase } from "../supabaseClient";

function ModalPago({ visible, onClose, onPagar, mesa, pedidoCompleto }) {
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [habitacion, setHabitacion] = useState("");
  const [facturar, setFacturar] = useState(false);
  const [nit, setNit] = useState("");
  const [errorHabitacion, setErrorHabitacion] = useState(""); 

  useEffect(() => {
    if (visible) {
      setMetodoPago("efectivo");
      setHabitacion("");
      setFacturar(false);
      setNit("");
      setErrorHabitacion(""); // Limpiar error al abrir
    }
  }, [visible, mesa]);

  const handlePagar = async () => {
    // Validar habitación si es recargado
    if (metodoPago === "recargado" && !habitacion.trim()) {
      setErrorHabitacion("Debes ingresar el número de habitación.");
      return;
    }

    setErrorHabitacion(""); // Limpiar error si todo bien

    const datosPago = {
      metodo: metodoPago,
      facturar,
      nit: facturar ? sanitizeText(nit) : null,
      habitacion: metodoPago === "recargado" ? sanitizeText(habitacion) : null,
    };

    if (datosPago?.metodo === "recargado") {
      // 1. Obtener usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay usuario autenticado");

      // 2. Obtener nombre del mesero actual desde la tabla infousuario
      const { data: infoUsuario, error: infoError } = await supabase
        .from('infousuario')
        .select('nombre')
        .eq('id', user.id)
        .single();

      if (infoError) throw infoError;

      const nombreMeseroActual = sanitizeText(infoUsuario?.nombre || "Mesero desconocido");

      // Simplificar detalle (sanitizado)
      const detalleSimplificado = (pedidoCompleto?.items || []).map((item) => ({
        nombre: sanitizeText(item?.nombre ?? ""),
        cantidad: sanitizeNumber(item?.cantidad ?? 1, false),
        precio: sanitizeNumber(item?.precio ?? 0, true),
      }));

      const { error: recargoError } = await supabase
        .from("pedidos_recargados")
        .insert({
          pedido_id: pedidoCompleto?.id,
          habitacion: sanitizeText(habitacion),
          detalle_pedido: detalleSimplificado,
          mesero: nombreMeseroActual,
          total: sanitizeNumber(pedidoCompleto?.total ?? 0, true),
        });

      if (recargoError) throw recargoError;
    }

    onPagar({ metodo: metodoPago, habitacion, facturar, nit });
    onClose();
  };

  if (!visible || !mesa) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white text-gray-800 rounded-xl p-6 w-full max-w-md animate-zoom-in">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Pago {sanitizeText(mesa)}</h2>
        <div className="space-y-4 text-gray-800">
          <div>
            <label className="block mb-2 font-medium text-gray-800">Método de pago:</label>
            <div className="flex gap-4 text-gray-800">
              <label className="flex items-center gap-2 text-gray-800">
                <input
                  type="radio"
                  checked={metodoPago === "efectivo"}
                  onChange={() => setMetodoPago("efectivo")}
                  className="text-green-600"
                />
                <span className="text-gray-800">Efectivo</span>
              </label>
              <label className="flex items-center gap-2 text-gray-800">
                <input
                  type="radio"
                  checked={metodoPago === "tarjeta"}
                  onChange={() => setMetodoPago("tarjeta")}
                  className="text-green-600"
                />
                <span className="text-gray-800">Tarjeta</span>
              </label>
              <label className="flex items-center gap-2 text-gray-800">
                <input
                  type="radio"
                  checked={metodoPago === "recargado"}
                  onChange={() => setMetodoPago("recargado")}
                  className="text-green-600"
                />
                <span className="text-gray-800">Recargado</span>
              </label>
              <label className="flex items-center gap-2 text-gray-800">
                <input
                  type="radio"
                  checked={metodoPago === "eventos"}
                  onChange={() => setMetodoPago("eventos")}
                  className="text-green-600"
                />
                <span className="text-gray-800">Eventos</span>
              </label>
            </div>
          </div>

          {metodoPago === "recargado" && (
            <div>
              <label className="block mb-2 font-medium text-gray-800">Número de habitación:</label>
              <input
                type="text"
                value={habitacion}
                onChange={(e) => setHabitacion(sanitizeText(e.target.value))}
                className={`w-full border rounded px-3 py-2 text-gray-800 ${errorHabitacion ? "border-red-500" : "border-gray-300"}`}
                placeholder="Ej: 101"
              />
              {errorHabitacion && (
                <p className="text-red-600 text-sm mt-1">{errorHabitacion}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-800">
            <input
              type="checkbox"
              id="facturar"
              checked={facturar}
              onChange={(e) => setFacturar(e.target.checked)}
              className="text-green-600"
            />
            <label htmlFor="facturar" className="text-gray-800">¿Necesita factura?</label>
          </div>

          {facturar && (
            <div>
              <label className="block mb-2 font-medium text-gray-800">NIT:</label>
              <input
                type="text"
                value={nit}
                onChange={(e) => setNit(sanitizeText(e.target.value))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800"
                placeholder="Ingrese NIT"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
            <button
              onClick={handlePagar}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Confirmar Pago
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModalPago;