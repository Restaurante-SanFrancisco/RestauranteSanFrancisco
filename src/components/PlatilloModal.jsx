import { useState, useEffect, useLayoutEffect } from "react";
import { supabase } from "../supabaseClient";
import { sanitizeText, sanitizeHtml } from "../utils/sanitize"; // Importar funciones de sanitización

function PlatilloModal({ platillo, onClose, onAdd }) {
  const [isClosing, setIsClosing] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [opciones, setOpciones] = useState([]);
  const [selecciones, setSelecciones] = useState({});
  const [cargando, setCargando] = useState(true);
  const [nota, setNota] = useState("");
  const [cantidad, setCantidad] = useState(1); // <-- Nuevo estado para cantidad

  // Resetear estado cuando cambia el platillo
  useLayoutEffect(() => {
    if (platillo) {
      setIsClosing(false);
      setShowAnimation(false);
      setOpciones([]);
      setSelecciones({});
      setNota("");
      setCantidad(1); // <-- Reset cantidad
      setCargando(true);
      requestAnimationFrame(() => setShowAnimation(true));
    }
  }, [platillo]);

  useEffect(() => {
    if (!platillo) return;

    async function cargarOpciones() {
      setCargando(true);
      try {
        const { data: platilloOpciones, error: errorOpciones } = await supabase
          .from("platillo_opciones")
          .select(`
            id,
            opcion_id,
            opciones:opcion_id (nombre)
          `)
          .eq("platillo_id", platillo.id);

        if (errorOpciones) throw errorOpciones;
        if (!platilloOpciones || platilloOpciones.length === 0) {
          setCargando(false);
          return;
        }

        const opcionesConValores = await Promise.all(
          platilloOpciones.map(async (po) => {
            const { data: valoresRelacion } = await supabase
              .from("platillo_opcion_valores")
              .select("opcion_valor_id")
              .eq("platillo_opcion_id", po.id);

            const valoresDetalles = await Promise.all(
              valoresRelacion.map(async (vr) => {
                const { data: valor } = await supabase
                  .from("opcion_valores")
                  .select("*")
                  .eq("id", vr.opcion_valor_id)
                  .single();
                return valor;
              })
            );

            return {
              id: po.opcion_id,
              nombre: sanitizeText(po.opciones.nombre), // Sanitizar nombre de opción
              valores: valoresDetalles
                .filter((v) => v)
                .map((v) => ({
                  id: v.id,
                  valor: sanitizeText(v.valor), // Sanitizar valor de opción
                })),
            };
          })
        );

        const opcionesValidas = opcionesConValores.filter(
          (op) => op.valores.length > 0
        );

        setOpciones(opcionesValidas);

        const seleccionesIniciales = {};
        opcionesValidas.forEach((op) => {
          seleccionesIniciales[op.id] = "";
        });
        setSelecciones(seleccionesIniciales);
      } catch (error) {
        console.error("Error cargando opciones:", error);
      } finally {
        setCargando(false);
      }
    }

    cargarOpciones();
  }, [platillo]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleNotaChange = (value) => {
    // Sanitizar texto de notas (permite formato básico pero seguro)
    setNota(sanitizeHtml(value));
  };

  const handleAdd = () => {
    // Sanitizar todos los datos antes de enviar
    const platilloConOpciones = {
      ...platillo,
      nombre: sanitizeText(platillo.nombre),
      opciones: Object.entries(selecciones)
        .filter(([_, valorId]) => valorId)
        .map(([opcionId, valorId]) => {
          const opcion = opciones.find((o) => o.id === opcionId);
          const valor = opcion?.valores.find((v) => v.id === valorId);
          return {
            opcion: sanitizeText(opcion.nombre),
            valor: sanitizeText(valor.valor),
          };
        }),
      nota: nota.trim() ? sanitizeHtml(nota.trim()) : null,
      precioTotal: platillo.precio,
      cantidad: cantidad, // <-- Agrega cantidad
    };

    setIsClosing(true);
    setTimeout(() => {
      onAdd(platilloConOpciones);
      onClose();
    }, 300);
  };

  if (!platillo) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-center items-center px-4">
      <div
        className={`bg-white text-verde rounded-xl shadow-2xl w-full max-w-md p-6 transition-all duration-300
          ${
            isClosing
              ? "animate-zoom-out"
              : showAnimation
              ? "animate-zoom-in"
              : "opacity-0"
          }`}
      >
        <h2 className="text-2xl font-bold mb-2">{sanitizeText(platillo.nombre)}</h2>

        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-2">Personalizar orden</h3>

          {cargando ? (
            <p className="text-center py-4">Cargando opciones...</p>
          ) : opciones.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Este platillo no tiene opciones de personalización
            </p>
          ) : (
            <div className="space-y-4">
              {opciones.map((opcion) => (
                <div key={opcion.id} className="space-y-1">
                  <label className="block font-medium capitalize">
                    {opcion.nombre}
                  </label>
                  <select
                    className="w-full border border-verde rounded px-3 py-2 bg-white"
                    value={selecciones[opcion.id] || ""}
                    onChange={(e) =>
                      setSelecciones({
                        ...selecciones,
                        [opcion.id]: sanitizeText(e.target.value), // Sanitizar valor del select
                      })
                    }
                  >
                    <option value="">Seleccione una opción</option>
                    {opcion.valores.map((valor) => (
                      <option key={valor.id} value={valor.id}>
                        {valor.valor}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Apartado de notas */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-2">Notas:</h3>
          <textarea
            className="w-full border border-verde rounded px-3 py-2 bg-white resize-none"
            rows="3"
            placeholder="Escriba aquí notas adicionales..."
            value={nota}
            onChange={(e) => handleNotaChange(e.target.value)} // Usar función sanitizadora
            maxLength="100" // Limitar longitud para prevenir ataques
          />
          <div className="text-xs text-gray-500 text-right mt-1">
            {nota.length}/100 caracteres
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-lg">Q{platillo.precio}</span>
          {/* Agrega input para cantidad */}
          <div className="flex items-center gap-2">
            <span className="font-semibold">Cantidad:</span>
            <input
  type="number"
  min="1"
  value={cantidad}
  onChange={(e) => {
    const value = e.target.value;
    // Permitir campo vacío temporalmente
    if (value === "") {
      setCantidad("");
      return;
    }
    
    const numValue = parseInt(value);
    // Solo actualizar si es un número válido y mayor que 0
    if (!isNaN(numValue) && numValue > 0) {
      setCantidad(numValue);
    }
  }}
  onBlur={(e) => {
    // Cuando pierde el foco, asegurar que tenga al menos 1
    if (e.target.value === "" || parseInt(e.target.value) < 1) {
      setCantidad(1);
    }
  }}
  className="w-16 border border-verde rounded px-2 py-1 text-center"
/>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="bg-gray-300 text-verde px-4 py-2 rounded hover:bg-gray-400 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={cargando}
            className="bg-verde text-white px-4 py-2 rounded hover:bg-emerald-900 transition-all disabled:opacity-50"
          >
            Agregar al pedido
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlatilloModal;