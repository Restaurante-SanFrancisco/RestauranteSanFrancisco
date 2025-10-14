import { useState, useEffect } from "react";
import PlatilloModal from "./PlatilloModal.jsx";
import ResumenPedido from "./ResumenPedido";
import ModalReporte from "./ModalReporte";
import ModalPago from "./ModalPago";
import ControlMesasModal from "./ControlMesasModal";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { sanitizeText, sanitizeNumber, sanitizeUrl, normalizeOpciones } from "../utils/sanitize";

// Comparador que acepta arrays u objetos (normaliza y compara)
function sonOpcionesIguales(op1, op2) {
  // Si ambos son null/undefined, son iguales
  if (!op1 && !op2) return true;
  
  // Si solo uno existe, no son iguales
  if (!op1 || !op2) return false;
  
  // Si son arrays, comparar cada elemento
  if (Array.isArray(op1) && Array.isArray(op2)) {
    if (op1.length !== op2.length) return false;
    
    return op1.every((op, index) => {
      const op2Item = op2[index];
      return op.opcion === op2Item.opcion && op.valor === op2Item.valor;
    });
  }
  
  // Para otros casos (objetos simples), comparar como strings
  return JSON.stringify(op1) === JSON.stringify(op2);
}

function MeseroPanel() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [platosCategoria, setPlatosCategoria] = useState([]);
  const [pedido, setPedido] = useState([]);
  const [modalPlatillo, setModalPlatillo] = useState(null);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [mostrarControlMesas, setMostrarControlMesas] = useState(false);
  const [mesas, setMesas] = useState({});
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [animarPlatos, setAnimarPlatos] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [mesaAPagar, setMesaAPagar] = useState(null);
  const [cerrandoControlMesas, setCerrondoControlMesas] = useState(false);
  const [mostrarReporte, setMostrarReporte] = useState(false);
  const [pedidoActualPago, setPedidoActualPago] = useState(null);

  // Cargar categorías desde Supabase (sanitizadas)
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data, error } = await supabase
          .from("categorias")
          .select("id, nombre, imagen");

        if (error) throw error;

        setCategorias((data || []).map(cat => ({
          ...cat,
          nombre: sanitizeText(cat?.nombre ?? ""),
          imagen: sanitizeUrl(cat?.imagen ?? "")
        })));
      } catch (err) {
        console.error("Error cargando categorías:", err);
      }
    };

    fetchCategorias();
  }, []);

  useEffect(() => {
    // Cargar datos iniciales
    cargarMesasOcupadas();

    // Crear suscripción para cambios en tiempo real
    const subscription = supabase
      .channel('mesas_ocupadas_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar todos los eventos: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'mesas_ocupadas'
        },
        (payload) => {
          // Cuando haya cambios, volver a cargar los datos
          cargarMesasOcupadas();
        }
      )
      .subscribe();

    // Limpiar suscripción al desmontar el componente
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Función para cargar mesas ocupadas desde Supabase (sanitiza items)
  const cargarMesasOcupadas = async () => {
    try {
      const { data, error } = await supabase
        .from('mesas_ocupadas')
        .select('numero, tipo, total, items');

      if (error) throw error;

      const mesasActuales = {};
      data.forEach(({ numero, tipo, total, items }) => {
        const clave = tipo === 'mesa' ? `Mesa ${numero}` : `Habitación ${numero}`;
        mesasActuales[clave] = {
          tipo: sanitizeText(tipo),
          total: sanitizeNumber(total, true),
          items: Array.isArray(items) ? items.map(item => ({
            ...item,
            nombre: sanitizeText(item?.nombre ?? ""),
            precio: sanitizeNumber(item?.precio ?? 0, true),
            cantidad: sanitizeNumber(item?.cantidad ?? 1, false),
            opciones: normalizeOpciones(item?.opciones)
          })) : []
        };
      });

      setMesas(mesasActuales);
    } catch (error) {
      console.error("Error cargando mesas ocupadas:", error);
    }
  };

  // Cargar mesas ocupadas al iniciar
  useEffect(() => {
    cargarMesasOcupadas();
  }, []);

  const agregarAlPedido = (platoNuevo) => {
    // Sanitizar plato antes de agregarlo
    const platoLimpio = {
      ...platoNuevo,
      nombre: sanitizeText(platoNuevo?.nombre ?? ""),
      precio: sanitizeNumber(platoNuevo?.precio ?? 0, true),
      opciones: normalizeOpciones(platoNuevo?.opciones)
    };

    setPedido((prevPedido) => {
      const index = prevPedido.findIndex(item =>
        item.id === platoLimpio.id && sonOpcionesIguales(item.opciones, platoLimpio.opciones)
      );

      if (index !== -1) {
        const nuevoPedido = [...prevPedido];
        nuevoPedido[index].cantidad += sanitizeNumber(platoNuevo.cantidad);
        return nuevoPedido;
      } else {
        // Usa la cantidad seleccionada en el modal
        return [...prevPedido, { ...platoLimpio, cantidad: sanitizeNumber(platoNuevo.cantidad) }];
      }
    });
  };

  const quitarDelPedido = (plato) => {
    setPedido((prevPedido) => {
      return prevPedido.filter(item => 
        // Comparar por id, opciones y nota (manejar null/undefined)
        !(item.id === plato.id && 
          sonOpcionesIguales(item.opciones, plato.opciones) &&
          (item.nota || null) === (plato.nota || null))
      );
    });
  };

  const setCantidadDelPedido = (item, nuevaCantidad) => {
    setPedido(prev => {
      if (nuevaCantidad < 1) {
        // Eliminar el platillo si la cantidad es menor a 1
        return prev.filter(p => p !== item);
      }
      return prev.map(p => (p === item ? { ...p, cantidad: nuevaCantidad } : p));
    });
  };

  const handleEnviarACocina = async (pedidoData) => {
  const destino = pedidoData.tipo === "mesa" ?
    `Mesa ${pedidoData.mesa}` :
    `Habitación ${pedidoData.habitacion}`;
  const numero = pedidoData.tipo === "mesa" ? pedidoData.mesa : pedidoData.habitacion;

  if (!Array.isArray(pedidoData.items) || pedidoData.items.length === 0) {
    toast.error("El pedido no contiene ningún ítem");
    return;
  }

  try {
    // Obtener usuario autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay usuario autenticado");

    // Obtener nombre del mesero desde la tabla infousuario
    const { data: infoUsuario, error: infoError } = await supabase
      .from('infousuario')
      .select('nombre')
      .eq('id', user.id)
      .single();

    if (infoError) throw infoError;

    const nombreMesero = sanitizeText(infoUsuario?.nombre || "Mesero desconocido");

    // Sanitizar items del pedido antes de guardar
    const itemsLimpios = (pedidoData.items || []).map(item => ({
      ...item,
      nombre: sanitizeText(item?.nombre ?? ""),
      precio: sanitizeNumber(item?.precio ?? 0, true),
      cantidad: sanitizeNumber(item?.cantidad ?? 1, false),
      opciones: normalizeOpciones(item?.opciones)
    }));

    const totalLimpio = sanitizeNumber(pedidoData.total ?? 0, true);

    // Verificar si la mesa/habitación ya está ocupada
    const { data: mesaOcupada } = await supabase
      .from('mesas_ocupadas')
      .select('*')
      .eq('numero', numero)
      .eq('tipo', pedidoData.tipo)
      .maybeSingle();

    if (mesaOcupada) {
    // Preguntar al usuario si quiere agregar al pedido existente
    const confirmar = window.confirm(
      `¡${destino} ya tiene un pedido activo!\n¿Desea agregar este pedido al existente?`
    );
    
    if (!confirmar) {
      return; // El usuario canceló
    }
  }

    if (mesaOcupada) {
      // ✅ CONCATENAR PEDIDO EXISTENTE CON EL NUEVO
      
      // 1. Obtener el pedido actual de la mesa
      const { data: pedidoExistente, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', mesaOcupada.pedido_id)
        .single();

      if (pedidoError) throw pedidoError;

      // 2. Combinar items del pedido existente con el nuevo
      const itemsCombinados = [
        ...(pedidoExistente.items || []),
        ...itemsLimpios
      ];

      // 3. Calcular nuevo total
      const nuevoTotal = sanitizeNumber(
        (pedidoExistente.total || 0) + totalLimpio,
        true
      );

      // 4. Actualizar pedido existente en Supabase
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({
          items: itemsCombinados,
          total: nuevoTotal,
          // Mantener otra información como mesero, destino, etc.
        })
        .eq('id', mesaOcupada.pedido_id);

      if (updateError) throw updateError;

      // 5. Actualizar mesa_ocupada con el nuevo total
      const { error: mesaUpdateError } = await supabase
        .from('mesas_ocupadas')
        .update({
          items: itemsCombinados,
          total: nuevoTotal
        })
        .eq('numero', numero)
        .eq('tipo', pedidoData.tipo);

      if (mesaUpdateError) throw mesaUpdateError;

      // 6. Actualizar estado local
      setMesas(prev => ({
        ...prev,
        [destino]: {
          items: itemsCombinados,
          total: nuevoTotal,
          tipo: pedidoData.tipo
        }
      }));

      toast.success(`Pedido agregado a ${destino} (pedido existente)`);
    } else {
      // ✅ CREAR NUEVO PEDIDO (código original)
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([{
          mesero: nombreMesero,
          destino,
          tipo: pedidoData.tipo,
          numero,
          items: itemsLimpios,
          total: totalLimpio,
        }])
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Marcar mesa/habitación como ocupada
      const { error: mesaError } = await supabase
        .from('mesas_ocupadas')
        .insert([{
          numero,
          tipo: pedidoData.tipo,
          pedido_id: pedido.id,
          total: totalLimpio,
          items: itemsLimpios
        }]);

      if (mesaError) throw mesaError;

      // Actualizar estado local
      setMesas(prev => ({
        ...prev,
        [destino]: {
          items: itemsLimpios,
          total: totalLimpio,
          tipo: pedidoData.tipo
        }
      }));

      toast.success(`Pedido enviado a cocina (${destino})`);
    }

    // Limpiar el pedido actual
    setPedido([]);
    setMostrarResumen(false);

  } catch (error) {
    console.error("Error al enviar pedido:", error);
    toast.error("Error al enviar el pedido a cocina");
  }
};

  const fetchPlatosPorCategoria = async (categoriaId) => {
    try {
      const { data: platillos, error } = await supabase
        .from("platillos")
        .select("id, nombre, precio")
        .eq("categoria_id", categoriaId);

      if (error) throw error;

      setPlatosCategoria((platillos || []).map(plato => ({
        ...plato,
        nombre: sanitizeText(plato?.nombre ?? ""),
        precio: sanitizeNumber(plato?.precio ?? 0, true)
      })));
    } catch (error) {
      console.error("Error cargando platillos:", error);
      setPlatosCategoria([]);
    }
  };

  const cambiarCategoria = (categoriaId) => {
    setAnimarPlatos(false);
    setTimeout(() => {
      setCategoriaActiva(categoriaId);
      fetchPlatosPorCategoria(categoriaId);
      setAnimarPlatos(true);
    }, 10);
  };

  const cerrarControlMesas = () => {
    setCerrondoControlMesas(true);
    setTimeout(() => {
      setMostrarControlMesas(false);
      setCerrondoControlMesas(false);
    }, 300);
  };

  const handlePagarMesa = async (datosPago) => {
    try {
      const ahora = new Date();
      // Ajustar a hora de Guatemala (UTC-6) restando 6 horas
      const ahoraGT = new Date(ahora.getTime() - (6 * 60 * 60 * 1000));
      const fecha = ahoraGT.toISOString().split("T")[0];
      const hora = ahoraGT.toISOString().split('T')[1].split('.')[0];

      // Sanitizar mesaAPagar antes de usar
      const destinoSan = sanitizeText(String(mesaAPagar || ""));
      const [tipoDestino, numeroStr] = destinoSan.split(" ");
      const tipo = tipoDestino?.toLowerCase() === "mesa" ? "mesa" : "habitación";
      const numero = parseInt((numeroStr || "").replace(/\D/g, ''), 10);

      // 1. Obtener el ID del pedido antes de eliminarlo de mesas_ocupadas
      const { data: mesaOcupada, error: fetchError } = await supabase
        .from("mesas_ocupadas")
        .select("pedido_id")
        .eq("numero", numero)
        .eq("tipo", tipo)
        .single();

      if (fetchError) throw fetchError;
      if (!mesaOcupada) throw new Error("No se encontró el pedido activo");

      const pedidoId = mesaOcupada.pedido_id;

      // 2. Eliminar de mesas_ocupadas
      const { error: deleteError } = await supabase
        .from("mesas_ocupadas")
        .delete()
        .eq("numero", numero)
        .eq("tipo", tipo);

      if (deleteError) throw deleteError;

      // 3. Actualizar pedido en la tabla pedidos
      const { error: updateError } = await supabase
        .from("pedidos")
        .update({
          terminado: true,
          metodo_pago: sanitizeText(datosPago?.metodo ?? ""),
          numero: datosPago?.metodo === "recargado" ? sanitizeText(datosPago?.habitacion ?? "") : numero,
          fecha,
          hora,
        })
        .eq("id", pedidoId);

      if (updateError) throw updateError;

      // 4. Obtener pedido completo
      const { data: pedidoCompleto, error: pedidoError } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", pedidoId)
        .single();

      if (pedidoError) throw pedidoError;

      // 6. Actualizar estado local (eliminar mesa)
      setMesas((prev) => {
        const nuevasMesas = { ...prev };
        delete nuevasMesas[mesaAPagar];
        return nuevasMesas;
      });

      setMesaSeleccionada(null);

      toast.success(`Pago registrado para ${sanitizeText(String(mesaAPagar || ""))}`);
    } catch (error) {
      console.error("Error al registrar pago:", error);
      toast.error(`Error al procesar el pago: ${sanitizeText(error?.message ?? String(error))}`);
    } finally {
      setMesaAPagar(null);
      setMostrarModalPago(false);
      setMesaSeleccionada(null);
    }
  };

  const abrirModalPago = async (mesaKey) => {
    // Obtener datos antes de eliminar/actualizar
    const [tipoDestino, numeroStr] = String(mesaKey).split(" ");
    const tipo = tipoDestino?.toLowerCase() === "mesa" ? "mesa" : "habitación";
    const numero = parseInt((numeroStr || "").replace(/\D/g, ''), 10);

    const { data: mesaOcupada } = await supabase
      .from("mesas_ocupadas")
      .select("pedido_id")
      .eq("numero", numero)
      .eq("tipo", tipo)
      .single();

    if (mesaOcupada) {
      const { data: pedidoCompleto } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", mesaOcupada.pedido_id)
        .single();

      setPedidoActualPago(pedidoCompleto);
      setMesaAPagar(mesaKey);
      setMostrarModalPago(true);
    }
  };

  const habitacionesActivas = Object.keys(mesas)
    .filter(key => key.startsWith("Habitación "))
    .map(key => key);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error al cerrar sesión: " + sanitizeText(error.message));
      return;
    }
    navigate("/"); // redirigir a login (ruta "/")
  };

  return (
    <div
      className="min-h-screen text-white p-6 animate-fade-in"
      style={{
        background: "linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%)",
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="text-white hover:text-red-400 transition p-1 rounded"
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
        <h1 className="text-3xl font-extrabold text-white tracking-tight text-center drop-shadow-lg flex-1 text-center">
          Menú del Restaurante
        </h1>
        <button
          onClick={() => setMostrarControlMesas(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl font-bold shadow transition"
        >
          🏷️ Control de Mesas
        </button>
        <button
          onClick={() => setMostrarReporte(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow transition"
        >
          📊 Reportes
        </button>
        
      </div>

      <ModalReporte
        visible={mostrarReporte}
        onClose={() => setMostrarReporte(false)}
      />

      <ControlMesasModal
        visible={mostrarControlMesas}
        onClose={cerrarControlMesas}
        mesas={mesas}
        mesaSeleccionada={mesaSeleccionada}
        setMesaSeleccionada={setMesaSeleccionada}
        setMesaAPagar={mesaKey => abrirModalPago(mesaKey)}
        setMostrarModalPago={setMostrarModalPago}
        cerrandoControlMesas={cerrandoControlMesas}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {categorias.map((cat) => (
          <div
            key={cat.id}
            onClick={() => cambiarCategoria(cat.id)}
            className={`bg-white text-verde rounded-xl shadow-md cursor-pointer 
              hover:shadow-xl hover:scale-[1.02] transition-transform duration-300 ease-in-out transform
              ${categoriaActiva === cat.id ? "ring-2 ring-amber-400" : ""}`}
          >
            <img
              src={sanitizeUrl(cat.imagen)}
              alt={sanitizeText(cat.nombre)}
              className="w-full h-32 object-cover rounded-t-xl"
            />
            <div className="p-3 font-semibold text-center">{sanitizeText(cat.nombre)}</div>
          </div>
        ))}
      </div>

      {categoriaActiva && (
        <div
          className={`bg-white text-verde rounded-xl p-4 mb-6 shadow-md ${
            animarPlatos ? "animate-slide-in-left" : ""
          }`}
        >
          <h2 className="text-xl font-bold mb-3 capitalize">
            {sanitizeText(categorias.find((c) => c.id === categoriaActiva)?.nombre || "")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {platosCategoria.length > 0 ? (
              platosCategoria.map((plato) => (
                <div
                  key={plato.id}
                  className="flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition"
                >
                  <span>{sanitizeText(plato.nombre)}</span>
                  <div className="flex items-center gap-2">
                    <span>Q{sanitizeNumber(plato.precio, true)}</span>
                    <button
                      onClick={() => setModalPlatillo(plato)}
                      className="bg-verde text-white px-3 py-1 rounded hover:bg-emerald-900"
                    >
                      Ver
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-600">No hay platillos en esta categoría.</p>
            )}
          </div>
        </div>
      )}

      {pedido.length > 0 && (
        <button
          onClick={() => setMostrarResumen(true)}
          className="fixed bottom-6 right-6 bg-verde text-white px-5 py-3 rounded-full shadow-lg 
            hover:bg-emerald-900 transition-transform duration-300 z-40 animate-bounce"
        >
          🧾 Ver pedido ({pedido.length})
        </button>
      )}

      <PlatilloModal
        platillo={modalPlatillo}
        onClose={() => setModalPlatillo(null)}
        onAdd={agregarAlPedido}
      />

      <ResumenPedido
        pedido={pedido}
        visible={mostrarResumen}
        onClose={() => setMostrarResumen(false)}
        onFinalizar={handleEnviarACocina}
        onCancelar={() => {
          if (confirm("¿Deseas cancelar todo el pedido?")) {
            setPedido([]);
            setMostrarResumen(false);
          }
        }}
        agregarAlPedido={agregarAlPedido}
        quitarDelPedido={quitarDelPedido}
        setCantidadDelPedido={setCantidadDelPedido}
      />

      <ModalPago
        visible={mostrarModalPago}
        onClose={() => {
          setMostrarModalPago(false);
          setMesaAPagar(null);
          setPedidoActualPago(null);
        }}
        onPagar={handlePagarMesa}
        mesa={mesaAPagar}
        pedidoCompleto={pedidoActualPago}
      />
    </div>
  );
}

export default MeseroPanel;