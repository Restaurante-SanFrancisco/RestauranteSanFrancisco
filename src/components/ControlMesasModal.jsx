import { sanitizeText, sanitizeNumber } from "../utils/sanitize";

function ControlMesasModal({
  visible,
  onClose,
  mesas,
  mesaSeleccionada,
  setMesaSeleccionada,
  setMesaAPagar,
  setMostrarModalPago,
  cerrandoControlMesas
}) {
  const habitacionesActivas = Object.keys(mesas)
    .filter(key => key.startsWith("Habitación "))
    .map(key => key);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className={`bg-gradient-to-br from-amber-50 via-white to-emerald-100 text-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] overflow-auto border-4 border-amber-300 ${cerrandoControlMesas ? 'animate-zoom-out' : 'animate-zoom-in'}`}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏷️</span>
            <h2 className="text-3xl font-extrabold tracking-tight">Control de Mesas y Habitaciones</h2>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-500 hover:text-amber-600 transition"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 mb-8">
          {Array.from({ length: 16 }, (_, i) => (i + 1).toString()).map((num) => {
            const ocupada = Boolean(mesas[`Mesa ${num}`]);
            return (
              <div
                key={num}
                className={`rounded-xl shadow-lg p-5 flex flex-col items-center justify-center transition-all duration-200
                  ${ocupada
                    ? "bg-gradient-to-br from-red-400 via-red-600 to-red-700 text-white ring-2 ring-red-300"
                    : "bg-gradient-to-br from-green-100 via-white to-green-200 text-green-900 hover:ring-2 hover:ring-emerald-400"}`}
              >
                <span className="text-3xl mb-2">🍽️</span>
                <span className="font-bold text-lg">Mesa {num}</span>
                {ocupada ? (
                  <div className="mt-2 text-sm font-medium">
                    <span className="block">Pedido activo</span>
                    <span className="block">Total: <span className="font-bold">Q{sanitizeNumber(mesas[`Mesa ${num}`]?.total ?? 0, true)}</span></span>
                    <button
                      onClick={() => setMesaSeleccionada(`Mesa ${num}`)}
                      className="mt-2 px-3 py-1 bg-white text-red-700 rounded shadow hover:bg-red-100 font-semibold"
                    >
                      Ver Detalle
                    </button>
                  </div>
                ) : (
                  <span className="mt-2 text-xs text-green-700">Disponible</span>
                )}
              </div>
            );
          })}
        </div>

        {habitacionesActivas.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-blue-600 text-2xl">🛏️</span>
              Habitaciones con pedido
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
              {habitacionesActivas.map(hab => (
                <div
                  key={hab}
                  className="rounded-xl shadow-lg p-5 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-300 text-blue-900 ring-2 ring-blue-300"
                >
                  <span className="text-3xl mb-2">🛏️</span>
                  <span className="font-bold text-lg">{sanitizeText(hab)}</span>
                  <div className="mt-2 text-sm font-medium">
                    <span className="block">Pedido activo</span>
                    <span className="block">Total: <span className="font-bold">Q{sanitizeNumber(mesas[hab]?.total ?? 0, true)}</span></span>
                    <button
                      onClick={() => setMesaSeleccionada(hab)}
                      className="mt-2 px-3 py-1 bg-white text-blue-700 rounded shadow hover:bg-blue-100 font-semibold"
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {mesaSeleccionada && mesas[mesaSeleccionada] && (
          <div className="bg-white rounded-xl shadow-xl p-6 mb-6 animate-fade-in border-2 border-emerald-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-emerald-700">Detalle {sanitizeText(mesaSeleccionada)}</h3>
              <button
                onClick={() => setMesaSeleccionada(null)}
                className="text-xl text-gray-500 hover:text-emerald-700 transition"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {mesas[mesaSeleccionada]?.items && Array.isArray(mesas[mesaSeleccionada].items) && (
              <>
                <ul className="space-y-2 mb-4">
                  {mesas[mesaSeleccionada].items.map((it, idx) => (
                    <li key={idx} className="flex justify-between items-center bg-emerald-50 rounded px-3 py-2">
                      <span>
                        <span className="font-semibold">{sanitizeNumber(it.cantidad ?? 1, false)}×</span> {sanitizeText(it.nombre)}
                      </span>
                      <span className="font-bold text-emerald-700">Q{sanitizeNumber((it.precio || 0) * (it.cantidad || 1), true)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between font-bold text-xl mt-3 pt-2 border-t border-emerald-200">
                  <span>Total:</span>
                  <span className="text-emerald-700">Q{sanitizeNumber(mesas[mesaSeleccionada]?.total || 0, true)}</span>
                </div>
              </>
            )}

            <button
              onClick={() => {
                setMesaAPagar(mesaSeleccionada);
                setMostrarModalPago(true);
              }}
              className="w-full bg-gradient-to-r from-emerald-500 to-amber-400 text-white py-3 rounded-xl mt-6 font-bold text-lg shadow hover:scale-105 transition"
            >
              Pagar
            </button>
          </div>
        )}

        <div className="flex justify-end mt-2">
          <button
            onClick={onClose}
            className="bg-amber-400 hover:bg-amber-500 text-white px-6 py-2 rounded-xl font-bold shadow transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


export default ControlMesasModal;
