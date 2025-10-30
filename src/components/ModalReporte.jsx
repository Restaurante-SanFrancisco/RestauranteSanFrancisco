import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-hot-toast";
import { sanitizeText, sanitizeHtmlReportes, sanitizeNumber, sanitizeObject } from "../utils/sanitize";

export default function ModalReporte({ visible, onClose }) {
  const [pedidos, setPedidos] = useState([]);
  const [infoRecargados, setInfoRecargados] = useState({});
  const [infoEmpleados, setInfoEmpleados] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [meseroActual, setMeseroActual] = useState('Sistema');
  const [modalDetalle, setModalDetalle] = useState({ visible: false, pedido: null });

  // Función para obtener la fecha y hora formateada de Guatemala
  const getFechaHoraGuatemala = () => {
    const ahora = new Date();
    const ahoraGT = new Date(ahora.getTime() - (6 * 60 * 60 * 1000));
    const fecha = ahoraGT.toISOString().split('T')[0];
    const horas = String(ahoraGT.getUTCHours()).padStart(2, '0');
    const minutos = String(ahoraGT.getUTCMinutes()).padStart(2, '0');
    const segundos = String(ahoraGT.getUTCSeconds()).padStart(2, '0');
    return { fecha, hora: `${horas}:${minutos}:${segundos}` };
  };

  // Función para formatear los items del pedido
  const formatearDetalleItems = (items) => {
    try {
      if (!items) return "Sin detalles";

      let itemsArray;
      if (typeof items === 'string') {
        try {
          itemsArray = JSON.parse(items);
        } catch (e) {
          return "Formato inválido";
        }
      } else {
        itemsArray = items;
      }

      if (!Array.isArray(itemsArray)) return "Formato inválido";

      return itemsArray.map(item => {
        const nombreLimpio = sanitizeText(item.nombre || '');
        const cantidad = sanitizeNumber(item.cantidad || 1, false);
        const precio = sanitizeNumber(item.precio || 0, true);
        const total = cantidad * precio;

        return `${cantidad} × ${nombreLimpio} - Q${total.toFixed(2)}`;
      }).join('\n');

    } catch (error) {
      console.error("Error formateando items:", error);
      return "Error al mostrar detalles";
    }
  };

  // Función para mostrar el modal de detalle
  const mostrarDetalle = (pedido) => {
    const pedidoLimpio = {
      ...pedido,
      id: sanitizeText(pedido.id),
      mesero: sanitizeText(pedido.mesero),
      items: pedido.items
    };
    setModalDetalle({ visible: true, pedido: pedidoLimpio });
  };

  // Función para cerrar el modal de detalle
  const cerrarModalDetalle = () => {
    setModalDetalle({ visible: false, pedido: null });
  };

  const getTurnoRange = () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();

    let start, end;
    let turno = "";
    let esCambioDeTurno = false;

    if (hour > 22 || (hour === 22 && minutes >= 1) || hour < 14 || (hour === 14 && minutes === 0)) {
      if (hour > 22 || (hour === 22 && minutes >= 1)) {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 1, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 14, 0, 0);
        esCambioDeTurno = (hour === 22 && minutes === 1);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 22, 1, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0);
        esCambioDeTurno = (hour === 14 && minutes === 1);
      }
      turno = "AM ";
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 1, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);
      turno = "PM ";
    }

    return { start, end, turno, esCambioDeTurno };
  };

  // Función para obtener datos de pedidos, recargados y empleados
  const fetchDatos = async () => {
    const { start, end } = getTurnoRange();

    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const fechasConsulta = [yesterdayStr, todayStr, tomorrowStr];

      const { data: pedidosData, error: pedidosError } = await supabase
        .from("pedidos")
        .select(
          "id, mesero, fecha, hora, destino, tipo, numero, total, metodo_pago, terminado, items"
        )
        .in("fecha", fechasConsulta)
        .order("fecha", { ascending: false })
        .order("hora", { ascending: false });

      if (pedidosError) throw pedidosError;

      const createDateFromStrings = (dateStr, timeStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes, seconds = 0] = timeStr.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes, seconds);
      };

      const pedidosFiltrados = pedidosData.filter((pedido) => {
        const pedidoDateTime = createDateFromStrings(pedido.fecha, pedido.hora);
        const estaEnRango = pedidoDateTime >= start && pedidoDateTime <= end;
        return estaEnRango;
      });

      const recargadosMap = {};
      const empleadosMap = {};

      // Obtener datos de pedidos recargados (habitaciones)
      const { data: recargadosActivos, error: recargadosError } = await supabase
        .from("pedidos_recargados")
        .select("pedido_id, habitacion, mesero");

      if (recargadosError)
        console.error("Error recargados activos:", recargadosError);

      if (recargadosActivos) {
        recargadosActivos.forEach((recargado) => {
          recargadosMap[recargado.pedido_id] = {
            habitacion: sanitizeText(recargado.habitacion),
            mesero: sanitizeText(recargado.mesero),
            cobrado: false,
          };
        });
      }

      // Obtener datos de empleados recargados
      const { data: empleadosRecargados, error: empleadosError } = await supabase
        .from("empleados_recargados")
        .select("pedido_id, empleado, mesero");

      if (empleadosError)
        console.error("Error empleados recargados:", empleadosError);

      if (empleadosRecargados) {
        empleadosRecargados.forEach((empleadoRec) => {
          empleadosMap[empleadoRec.pedido_id] = {
            empleado: sanitizeText(empleadoRec.empleado),
            mesero: sanitizeText(empleadoRec.mesero),
          };
        });
      }

      // Procesar pedidos históricos (para compatibilidad)
      pedidosFiltrados.forEach((pedido) => {
        if (pedido.mesero && pedido.mesero.includes("/") && pedido.terminado) {
          recargadosMap[pedido.id] = {
            habitacion: sanitizeText(pedido.numero),
            mesero: sanitizeText(pedido.mesero),
            cobrado: true,
          };
        }
      });

      const pedidosLimpios = (pedidosFiltrados || []).map(pedido => ({
        ...pedido,
        id: sanitizeText(pedido.id),
        mesero: sanitizeText(pedido.mesero),
        destino: sanitizeText(pedido.destino),
        tipo: sanitizeText(pedido.tipo),
        numero: sanitizeText(pedido.numero),
        metodo_pago: sanitizeText(pedido.metodo_pago),
        total: sanitizeNumber(pedido.total, true)
      }));

      setPedidos(pedidosLimpios);
      setInfoRecargados(recargadosMap);
      setInfoEmpleados(empleadosMap);
    } catch (error) {
      console.error("Error cargando datos:", error);
    }
  };

  // Función para enviar reporte a recepción
  const enviarARecepcion = async () => {
    setEnviando(true);
    try {
      const { fecha: fechaCorrecta, hora: horaCorrecta } = getFechaHoraGuatemala();

      const { turno: turnoActual } = getTurnoRange();

      const meseroLimpio = sanitizeText(meseroActual);
      const turnoLimpio = sanitizeText(turnoActual);
      const fechaLimpia = sanitizeText(new Date().toLocaleDateString('es-GT'));

      const pedidosTerminadosActuales = pedidos.filter(pedido => pedido.terminado);

      const {
        totalEfectivo,
        totalTarjeta,
        totalRecargado,
        totalTransferencia,
        totalEventos,
        totalEmpleados
      } = calcularTotalesDesdePedidos(pedidosTerminadosActuales);

      const reporteHTML = `
        <div style="background: linear-gradient(135deg, #000000ff 0%, #0d4922ff 80%); color: white; padding: 20px; border-radius: 10px;">
          <h2 style="text-align: center; font-size: 24px; font-weight: bold; color: #fbbf24; margin-bottom: 10px;">
            REPORTE DE VENTAS
          </h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
            <div style="background: #374151; padding: 10px; border-radius: 5px;">
              <span style="font-weight: bold; color: #fbbf24;">Generado por:</span> ${meseroLimpio}
            </div>
            <div style="background: #374151; padding: 10px; border-radius: 5px;">
              <span style="font-weight: bold; color: #fbbf24;">Fecha:</span> ${fechaLimpia}
            </div>
            <div style="background: #374151; padding: 10px; border-radius: 5px;">
              <span style="font-weight: bold; color: #fbbf24;">Turno:</span> ${turnoLimpio}
            </div>
            <div style="background: #374151; padding: 10px; border-radius: 5px;">
              <span style="font-weight: bold; color: #fbbf24;">Total Pedidos:</span> ${pedidosTerminadosActuales.length}
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #4b5563; font-size: 14px;">
            <thead>
              <tr style="background: #374151;">
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #fbbf24;">ID Pedido</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #10b981;">Efectivo</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #3b82f6;">Tarjeta</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #8b5cf6;">Recargado</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #f59e0b;">Transferencia</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #acf65cff;">Eventos</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #f97316;">Habitación</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #ec4899;">Empleados</th>
                <th style="padding: 10px; border: 1px solid #4b5563; font-weight: bold; color: #06b6d4;">Mesero</th>
              </tr>
            </thead>
            <tbody>
              ${pedidosTerminadosActuales.map(pedido => {
        const infoRecargado = infoRecargados[pedido.id];
        const infoEmpleado = infoEmpleados[pedido.id];
        const fueRecargado = !!infoRecargado;
        const fueEmpleado = !!infoEmpleado;

        const idLimpio = sanitizeText(pedido.id);
        const totalLimpio = Number(sanitizeNumber(pedido.total, true)).toFixed(2);
        const habitacionLimpia = fueRecargado ? sanitizeText(infoRecargado.habitacion) : '-';
        const empleadoLimpio = fueEmpleado ? sanitizeText(infoEmpleado.empleado) : '-';
        const meseroLimpio = fueRecargado ? sanitizeText(infoRecargado.mesero) :
          fueEmpleado ? sanitizeText(infoEmpleado.mesero) :
            sanitizeText(pedido.mesero);

        return `
                  <tr style="background: #1f2937;">
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center;">${idLimpio}</td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #10b981;">
                      ${pedido.metodo_pago === 'efectivo' ? `Q${totalLimpio}` : '-'}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #3b82f6;">
                      ${pedido.metodo_pago === 'tarjeta' ? `Q${totalLimpio}` : '-'}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #8b5cf6;">
                      ${pedido.metodo_pago === 'recargado' ? `Q${totalLimpio}` : '-'}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #f59e0b;">
                      ${pedido.metodo_pago === 'transferencia' ? `Q${totalLimpio}` : '-'}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #acf65cff;">
                      ${pedido.metodo_pago === 'eventos' ? `Q${totalLimpio}` : '-'}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #f97316;">
                      ${habitacionLimpia}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #ec4899;">
                      ${empleadoLimpio}
                    </td>
                    <td style="padding: 8px; border: 1px solid #4b5563; text-align: center; color: #06b6d4;">
                      ${meseroLimpio}
                    </td>
                  </tr>
                `;
      }).join('')}
              <tr style="background: #374151; font-weight: bold;">
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #fbbf24;">TOTALES</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #10b981;">Q${Number(sanitizeNumber(totalEfectivo, true)).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #3b82f6;">Q${Number(sanitizeNumber(totalTarjeta, true)).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #8b5cf6;">Q${Number(sanitizeNumber(totalRecargado, true)).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #f59e0b;">Q${Number(sanitizeNumber(totalTransferencia, true)).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #acf65cff;">Q${Number(sanitizeNumber(totalEventos, true)).toFixed(2)}</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #f97316;">-</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #ec4899;">-</td>
                <td style="padding: 10px; border: 1px solid #4b5563; text-align: center; color: #06b6d4;">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      const reporteHTMLSeguro = sanitizeHtmlReportes(reporteHTML);

      const reporteData = sanitizeObject({
        fecha: fechaCorrecta,
        turno: turnoLimpio,
        total_efectivo: Number(sanitizeNumber(totalEfectivo, true)),
        total_tarjeta: Number(sanitizeNumber(totalTarjeta, true)),
        total_recargado: Number(sanitizeNumber(totalRecargado, true)),
        total_transferencia: Number(sanitizeNumber(totalTransferencia, true)),
        total_eventos: Number(sanitizeNumber(totalEventos, true)),
        total_empleados: Number(sanitizeNumber(totalEmpleados, true)),
        total_pedidos: pedidosTerminadosActuales.length,
        datos_reportes: pedidosTerminadosActuales.map(pedido => ({
          ...pedido,
          items: typeof pedido.items === 'string' ? pedido.items : JSON.stringify(pedido.items)
        })),
        mesero_recepcionista: meseroLimpio,
        reporte_html: reporteHTMLSeguro,
        formato_especial: true,
      });

      const { data, error } = await supabase
        .from('reportes_enviados')
        .upsert([reporteData], {
          onConflict: 'fecha,turno',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      const esActualizacion = data && data[0] && data[0].id;

      if (esActualizacion) {
        toast.success('✅ Reporte actualizado correctamente en recepción');
      } else {
        toast.success('✅ Reporte enviado correctamente a recepción');
      }

    } catch (error) {
      console.error('Error enviando reporte:', error);
      toast.error('❌ Error al enviar el reporte: ' + sanitizeText(error.message));
    } finally {
      setEnviando(false);
    }
  };

  // Función auxiliar para calcular totales
  const calcularTotalesDesdePedidos = (pedidosArray) => {
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalRecargado = 0;
    let totalTransferencia = 0;
    let totalEventos = 0;
    let totalEmpleados = 0;

    pedidosArray.forEach(pedido => {
      if (pedido.terminado) {
        const totalLimpio = sanitizeNumber(pedido.total, true);
        switch (pedido.metodo_pago) {
          case 'efectivo':
            totalEfectivo += totalLimpio;
            break;
          case 'tarjeta':
            totalTarjeta += totalLimpio;
            break;
          case 'recargado':
            totalRecargado += totalLimpio;
            break;
          case 'transferencia':
            totalTransferencia += totalLimpio;
            break;
          case 'eventos':
            totalEventos += totalLimpio;
            break;
          case 'empleados':
            totalEmpleados += totalLimpio;
            break;
        }
      }
    });

    return {
      totalEfectivo,
      totalTarjeta,
      totalRecargado,
      totalTransferencia,
      totalEventos,
      totalEmpleados
    };
  };

  // useEffect para suscripción a cambios
  useEffect(() => {
    const obtenerUsuarioActual = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: usuarioInfo } = await supabase
            .from('infousuario')
            .select('nombre')
            .eq('id', user.id)
            .single();

          setMeseroActual(sanitizeText(usuarioInfo?.nombre || user.email || 'Mesero'));
        }
      } catch (error) {
        console.error("Error obteniendo usuario:", error);
        setMeseroActual('Sistema');
      }
    };

    const inicializar = async () => {
      if (visible) {
        await obtenerUsuarioActual();
        fetchDatos();

        const channel = supabase
          .channel("reporte-changes")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pedidos" },
            () => fetchDatos()
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pedidos_recargados" },
            () => fetchDatos()
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "empleados_recargados" },
            () => fetchDatos()
          )
          .subscribe();

        return channel;
      }
    };

    let channelRef;
    inicializar().then((channel) => {
      channelRef = channel;
    });

    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [visible]);

  // useEffect para guardado automático
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();

      if ((hour === 13 && minutes === 59) || (hour === 21 && minutes === 59)) {
        const pedidosTerminadosActuales = pedidos.filter(pedido => pedido.terminado);

        if (pedidosTerminadosActuales.length > 0) {
          enviarARecepcion();
        }
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [pedidos]);

  // Calcular totales
  const calcularTotales = () => {
    let totalEfectivo = 0;
    let totalTarjeta = 0;
    let totalRecargado = 0;
    let totalTransferencia = 0;
    let totalEventos = 0;
    let totalEmpleados = 0;

    pedidos.forEach(pedido => {
      if (pedido.terminado) {
        const totalLimpio = sanitizeNumber(pedido.total, true);
        switch (pedido.metodo_pago) {
          case 'efectivo':
            totalEfectivo += totalLimpio;
            break;
          case 'tarjeta':
            totalTarjeta += totalLimpio;
            break;
          case 'recargado':
            totalRecargado += totalLimpio;
            break;
          case 'transferencia':
            totalTransferencia += totalLimpio;
            break;
          case 'eventos':
            totalEventos += totalLimpio;
            break;
          case 'empleados':
            totalEmpleados += totalLimpio;
            break;
        }
      }
    });

    return {
      totalEfectivo: sanitizeNumber(totalEfectivo, true),
      totalTarjeta: sanitizeNumber(totalTarjeta, true),
      totalRecargado: sanitizeNumber(totalRecargado, true),
      totalTransferencia: sanitizeNumber(totalTransferencia, true),
      totalEventos: sanitizeNumber(totalEventos, true),
      totalEmpleados: sanitizeNumber(totalEmpleados, true)
    };
  };

  if (!visible) return null;

  const {
    totalEfectivo,
    totalTarjeta,
    totalRecargado,
    totalTransferencia,
    totalEventos,
    totalEmpleados
  } = calcularTotales();

  const { turno } = getTurnoRange();
  const fechaActual = new Date(new Date().getTime() - (6 * 60 * 60 * 1000)).toLocaleDateString('es-GT');
  const pedidosTerminados = pedidos.filter(pedido => pedido.terminado);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white w-[95%] max-w-7xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">REPORTE DE VENTAS</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-700 p-2 rounded">
                <span className="font-semibold text-yellow-300">Generado por:</span> {sanitizeText(meseroActual)}
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <span className="font-semibold text-yellow-300">Fecha:</span> {sanitizeText(fechaActual)}
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <span className="font-semibold text-yellow-300">Turno:</span> {sanitizeText(turno)}
              </div>
              <div className="bg-gray-700 p-2 rounded">
                <span className="font-semibold text-yellow-300">Total Pedidos:</span> {pedidosTerminados.length}
              </div>
            </div>
          </div>

          {pedidosTerminados.length === 0 ? (
            <p className="text-gray-300 text-center py-8">No hay pedidos en este turno.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-600 text-sm">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="p-3 border border-gray-600 font-semibold text-yellow-300">ID Pedido</th>
                    <th className="p-3 border border-gray-600 font-semibold text-green-300">Efectivo</th>
                    <th className="p-3 border border-gray-600 font-semibold text-blue-300">Tarjeta</th>
                    <th className="p-3 border border-gray-600 font-semibold text-purple-300">Recargado</th>
                    <th className="p-3 border border-gray-600 font-semibold text-amber-300">Transferencia</th>
                    <th className="p-3 border border-gray-600 font-semibold text-yellow-300">Eventos</th>
                    <th className="p-3 border border-gray-600 font-semibold text-orange-300">Habitación</th>
                    <th className="p-3 border border-gray-600 font-semibold text-pink-300">Empleados</th>
                    <th className="p-3 border border-gray-600 font-semibold text-cyan-300">Mesero</th>
                    <th className="p-3 border border-gray-600 font-semibold text-emerald-300">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosTerminados.map((pedido) => {
                    const infoRecargado = infoRecargados[pedido.id];
                    const infoEmpleado = infoEmpleados[pedido.id];
                    const fueRecargado = !!infoRecargado;
                    const fueEmpleado = !!infoEmpleado;

                    return (
                      <tr key={pedido.id} className="hover:bg-gray-700 border-b border-gray-600">
                        <td className="p-2 border border-gray-600 text-center text-white">{sanitizeText(pedido.id)}</td>

                        <td className="p-2 border border-gray-600 text-center">
                          {pedido.metodo_pago === 'efectivo' ?
                            <span className="text-green-300 font-medium">Q{sanitizeNumber(pedido.total, true).toFixed(2)}</span> :
                            <span className="text-gray-400">-</span>
                          }
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {pedido.metodo_pago === 'tarjeta' ?
                            <span className="text-blue-300 font-medium">Q{sanitizeNumber(pedido.total, true).toFixed(2)}</span> :
                            <span className="text-gray-400">-</span>
                          }
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {pedido.metodo_pago === 'recargado' ?
                            <span className="text-purple-300 font-medium">Q{sanitizeNumber(pedido.total, true).toFixed(2)}</span> :
                            <span className="text-gray-400">-</span>
                          }
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {pedido.metodo_pago === 'transferencia' ?
                            <span className="text-amber-300 font-medium">Q{sanitizeNumber(pedido.total, true).toFixed(2)}</span> :
                            <span className="text-gray-400">-</span>
                          }
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {pedido.metodo_pago === 'eventos' ?
                            <span className="text-yellow-300 font-medium">Q{sanitizeNumber(pedido.total, true).toFixed(2)}</span> :
                            <span className="text-gray-400">-</span>
                          }
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {fueRecargado ? sanitizeText(infoRecargado.habitacion) : <span className="text-gray-400">-</span>}
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {fueEmpleado ? sanitizeText(infoEmpleado.empleado) : <span className="text-gray-400">-</span>}
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          {fueRecargado ? sanitizeText(infoRecargado.mesero) :
                            fueEmpleado ? sanitizeText(infoEmpleado.mesero) :
                              sanitizeText(pedido.mesero)}
                        </td>

                        <td className="p-2 border border-gray-600 text-center">
                          <button
                            onClick={() => mostrarDetalle(pedido)}
                            className="bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-500 transition"
                          >
                            Ver Items
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-gray-700 font-bold">
                    <td className="p-3 border border-gray-600 text-center text-yellow-300">TOTALES</td>
                    <td className="p-3 border border-gray-600 text-center text-green-300">
                      Q{sanitizeNumber(totalEfectivo, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-blue-300">
                      Q{sanitizeNumber(totalTarjeta, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-purple-300">
                      Q{sanitizeNumber(totalRecargado, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-amber-300">
                      Q{sanitizeNumber(totalTransferencia, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-yellow-300">
                      Q{sanitizeNumber(totalEventos, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-orange-300">-</td>
                    <td className="p-3 border border-gray-600 text-center text-pink-300">
                      Q{sanitizeNumber(totalEmpleados, true).toFixed(2)}
                    </td>
                    <td className="p-3 border border-gray-600 text-center text-cyan-300">-</td>
                    <td className="p-3 border border-gray-600 text-center">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={enviarARecepcion}
              disabled={enviando || pedidosTerminados.length === 0}
              className="bg-blue-500 text-white px-6 py-2 rounded font-bold hover:bg-blue-400 disabled:bg-gray-400 transition"
            >
              {enviando ? 'Enviando...' : '📤 Enviar a Recepción'}
            </button>
            <button
              onClick={onClose}
              className="bg-yellow-500 text-gray-900 px-6 py-2 rounded font-bold hover:bg-yellow-400 transition"
            >
              Cerrar Reporte
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalle de Items */}
      {modalDetalle.visible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white w-[90%] max-w-2xl rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-yellow-400">
                Detalle del Pedido #{sanitizeText(modalDetalle.pedido.id)}
              </h3>
              <button
                onClick={cerrarModalDetalle}
                className="text-gray-400 hover:text-white text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-700 p-3 rounded">
                <span className="font-semibold text-yellow-300">Mesero:</span> {sanitizeText(modalDetalle.pedido.mesero)}
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <span className="font-semibold text-yellow-300">Método Pago:</span> {sanitizeText(modalDetalle.pedido.metodo_pago)}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-yellow-300 mb-2">Items del Pedido:</h4>
              <div className="bg-gray-700 p-4 rounded max-h-60 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm">
                  {formatearDetalleItems(modalDetalle.pedido.items)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={cerrarModalDetalle}
                className="bg-yellow-500 text-gray-900 px-4 py-2 rounded font-bold hover:bg-yellow-400 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
