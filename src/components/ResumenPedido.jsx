import { useState, useLayoutEffect } from "react";
import { toast } from "react-hot-toast";
import { sanitizeText, sanitizeNumber, sanitizeHtml } from "../utils/sanitize"; // Importar funciones de sanitización

function ResumenPedido({
  pedido,
  visible,
  onClose,
  onFinalizar,
  onCancelar,
  quitarDelPedido,
  setCantidadDelPedido, // <-- NUEVO PROP
}) {
  const [show, setShow] = useState(false);
  const [mostrarModalDestino, setMostrarModalDestino] = useState(false);
  const [tipoDestino, setTipoDestino] = useState("mesa");
  const [numeroDestino, setNumeroDestino] = useState("");
  const [cerrandoModal, setCerrandoModal] = useState(false);

  useLayoutEffect(() => {
    if (visible) {
      setShow(false);
      requestAnimationFrame(() => {
        setShow(true);
      });
    }
  }, [visible]);

  const handleNumeroDestinoChange = (value) => {
    // Sanitizar número de destino (solo números)
    setNumeroDestino(sanitizeNumber(value, false)); // false = no permite decimales
  };

  const confirmarEnvio = () => {
    const numeroLimpio = sanitizeNumber(numeroDestino, false);
    
    if (!numeroLimpio || isNaN(numeroLimpio)) {
      toast(`Por favor ingresa el número de ${tipoDestino}.`);
      return;
    }

    // Sanitizar todos los datos del pedido antes de enviar
    const pedidoData = {
      tipo: sanitizeText(tipoDestino),
      mesa: tipoDestino === "mesa" ? numeroLimpio : null,
      habitacion: tipoDestino === "habitación" ? numeroLimpio : null,
      items: pedido.map(item => ({
        ...item,
        nombre: sanitizeText(item.nombre),
        opciones: item.opciones ? item.opciones.map(opcion => ({
          opcion: sanitizeText(opcion.opcion),
          valor: sanitizeText(opcion.valor)
        })) : [],
        nota: item.nota ? sanitizeHtml(item.nota) : null,
        precio: sanitizeNumber(item.precio, true) // true = permite decimales
      })),
      total: sanitizeNumber(
        pedido.reduce((sum, item) => sum + (item.precio * item.cantidad), 0),
        true
      )
    };

    onFinalizar(pedidoData);
    cerrarConAnimacion();
  };

  const cerrarConAnimacion = () => {
    setCerrandoModal(true);
    setTimeout(() => {
      setMostrarModalDestino(false);
      setCerrandoModal(false);
      setNumeroDestino("");
    }, 300);
  };

  if (!visible) return null;

  const total = pedido.reduce(
    (sum, item) => sum + item.precio * item.cantidad,
    0
  );

  // función para cambiar cantidad
  const handleCambiarCantidad = (item, delta) => {
  const nuevaCantidad = item.cantidad + delta;
  
  if (nuevaCantidad < 1) {
    // Eliminar el ítem completamente si la cantidad sería 0
    quitarDelPedido(item);
  } else {
    // Actualizar la cantidad normalmente
    setCantidadDelPedido(item, nuevaCantidad);
  }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        ></div>

        <div
          className={`relative bg-white text-verde h-full w-full max-w-sm shadow-2xl transition-transform duration-300 ease-in-out
            ${show ? "translate-x-0" : "translate-x-full"}
          `}
        >
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-semibold">Resumen del Pedido</h2>
            <button
              onClick={onClose}
              className="text-red-600 text-lg hover:text-red-800"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-180px)]">
            {pedido.length === 0 ? (
              <p className="text-gray-500">
                Aún no se ha agregado ningún platillo.
              </p>
            ) : (
              pedido.map((item, index) => (
                <div
                  key={index}
                  className="border border-verde rounded-lg p-3 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{sanitizeText(item.nombre)}</h3>
                      {item.opciones && item.opciones.length > 0 && (
                        <ul className="text-sm text-gray-600 list-disc ml-5 mt-1">
                          {item.opciones.map((opcion, idx) => (
                            <li key={idx}>
                              {sanitizeText(opcion.opcion)}: {sanitizeText(opcion.valor)}
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* Mostrar notas si existen */}
                      {item.nota && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-800 font-medium">Nota:</p>
                          <p className="text-sm text-yellow-700">{sanitizeHtml(item.nota)}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {item.cantidad} × Q{sanitizeNumber(item.precio, true)} = Q
                        {sanitizeNumber(item.precio * item.cantidad, true)}
                      </p>
                      {/* Botones + y - */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleCambiarCantidad(item, -1)}
                          className="bg-gray-200 text-verde px-2 py-1 rounded hover:bg-gray-300"
                        >-</button>
                        <span className="mx-2">{item.cantidad}</span>
                        <button
                          onClick={() => handleCambiarCantidad(item, 1)}
                          className="bg-gray-200 text-verde px-2 py-1 rounded hover:bg-gray-300"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="font-bold">Total:</span>
              <span className="font-bold text-lg">Q{sanitizeNumber(total, true)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <button
                onClick={onCancelar}
                className="bg-gray-200 text-verde px-4 py-2 rounded hover:bg-gray-300 w-full"
              >
                Cancelar todo
              </button>
              <button
                onClick={() => setMostrarModalDestino(true)}
                className="bg-verde text-white px-4 py-2 rounded hover:bg-emerald-900 w-full"
                disabled={pedido.length === 0}
              >
                Finalizar pedido
              </button>
            </div>
          </div>
        </div>
      </div>

      {mostrarModalDestino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => cerrarConAnimacion()}
          ></div>

          <div
            className={`bg-white text-verde p-6 rounded-xl w-80 space-y-4 shadow-xl relative z-10
              ${cerrandoModal ? "animate-zoom-out" : "animate-zoom-in"}`}
          >
            <h2 className="text-lg font-bold">Destino del pedido</h2>

            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tipo"
                  value="mesa"
                  checked={tipoDestino === "mesa"}
                  onChange={() => setTipoDestino("mesa")}
                  className="text-verde"
                />
                <span>Mesa</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="tipo"
                  value="habitación"
                  checked={tipoDestino === "habitación"}
                  onChange={() => setTipoDestino("habitación")}
                  className="text-verde"
                />
                <span>Habitación</span>
              </label>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Número de {tipoDestino}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={`Número:  ${tipoDestino === "mesa" ? "5" : "101"}`}
                className="w-full border border-verde rounded px-3 py-2 focus:ring-2 focus:ring-verde focus:border-transparent"
                value={numeroDestino}
                onChange={(e) => handleNumeroDestinoChange(e.target.value)}
                maxLength="4"
              />
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <button
                onClick={cerrarConAnimacion}
                className="bg-gray-200 text-verde px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvio}
                className="bg-verde text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors"
                disabled={!numeroDestino || isNaN(numeroDestino)}
              >
                Enviar a cocina
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ResumenPedido;