import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { sanitizeText, sanitizeNumber } from "../utils/sanitize"; // ✅ Importación añadida

const initialForm = { id: null, nombre: "", precio: "", categoria_id: "" };
const initialCategoryForm = { id: null, nombre: "", imagen: "" };

export default function AdministracionPlatos() {
  const navigate = useNavigate();
  // Data
  const [platillos, setPlatillos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [opciones, setOpciones] = useState([]);
  const [opcionValores, setOpcionValores] = useState([]);
  const [platilloOpciones, setPlatilloOpciones] = useState([]);
  const [platilloOpcionValores, setPlatilloOpcionValores] = useState([]);

  // UI/State
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [expanded, setExpanded] = useState({});
  const [errors, setErrors] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("platillos");

  // Crear/editar auxiliares
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionValue, setNewOptionValue] = useState({ opcion_id: "", valor: "" });
  const [editingOption, setEditingOption] = useState(null);
  const [editingValue, setEditingValue] = useState(null);

  // Asignaciones
  const [assign, setAssign] = useState({
    platillo_id: "",
    opcion_id: "",
    platillo_opcion_id: "",
    opcion_valor_id: "",
  });

  // ✅ Handler sanitizado para búsqueda
  const handleSearchChange = (e) => {
    const valorLimpio = sanitizeText(e.target.value);
    setSearch(valorLimpio);
  };

  // ✅ Handler sanitizado para formulario de platillo
  const handleFormChange = (field, value) => {
    let valorLimpio = value;
    
    if (field === 'nombre') {
      valorLimpio = sanitizeText(value);
    } else if (field === 'precio') {
      valorLimpio = sanitizeNumber(value);
    } else if (field === 'categoria_id') {
      valorLimpio = value; // ID no necesita sanitización
    }

    setForm(prev => ({ ...prev, [field]: valorLimpio }));
  };

  // ✅ Handler sanitizado para formulario de categoría
  const handleCategoryFormChange = (field, value) => {
    let valorLimpio = value;
    
    if (field === 'nombre') {
      valorLimpio = sanitizeText(value);
    } else if (field === 'imagen') {
      valorLimpio = value; // URL no se sanitiza para no romper enlaces
    }

    setCategoryForm(prev => ({ ...prev, [field]: valorLimpio }));
  };

  // ✅ Handler sanitizado para nueva opción
  const handleNewOptionNameChange = (value) => {
    const valorLimpio = sanitizeText(value);
    setNewOptionName(valorLimpio);
  };

  // ✅ Handler sanitizado para nuevo valor de opción
  const handleNewOptionValueChange = (field, value) => {
    let valorLimpio = value;
    
    if (field === 'valor') {
      valorLimpio = sanitizeText(value);
    } else if (field === 'opcion_id') {
      valorLimpio = value; // ID no necesita sanitización
    }

    setNewOptionValue(prev => ({ ...prev, [field]: valorLimpio }));
  };

  // Filtros
  const filteredPlatillos = useMemo(() => {
    if (!search.trim()) return platillos;
    const q = search.toLowerCase();
    return platillos.filter(
      (p) =>
        p.nombre?.toLowerCase().includes(q) ||
        categorias.find((c) => c.id === p.categoria_id)?.nombre?.toLowerCase().includes(q)
    );
  }, [platillos, search, categorias]);

  const filteredCategorias = useMemo(() => {
    if (!search.trim()) return categorias;
    const q = search.toLowerCase();
    return categorias.filter((c) => c.nombre?.toLowerCase().includes(q));
  }, [categorias, search]);

  useEffect(() => {
    loadAll();
    const cleanup = setupRealtimeSubscriptions();
    return cleanup;
  }, []);

  // Configurar suscripciones en tiempo real
  function setupRealtimeSubscriptions() {
    // Suscripción a platillos
    const platillosSubscription = supabase
      .channel('platillos-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'platillos' }, 
        (payload) => {
          handlePlatilloChange(payload);
        }
      )
      .subscribe();

    // Suscripción a categorías
    const categoriasSubscription = supabase
      .channel('categorias-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'categorias' }, 
        (payload) => {
          handleCategoriaChange(payload);
        }
      )
      .subscribe();

    // Suscripción a opciones
    const opcionesSubscription = supabase
      .channel('opciones-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'opciones' }, 
        (payload) => {
          handleOpcionChange(payload);
        }
      )
      .subscribe();

    // Suscripción a valores de opciones
    const opcionValoresSubscription = supabase
      .channel('opcion-valores-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'opcion_valores' }, 
        (payload) => {
          handleOpcionValorChange(payload);
        }
      )
      .subscribe();

    // Suscripción a relaciones platillo-opciones
    const platilloOpcionesSubscription = supabase
      .channel('platillo-opciones-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'platillo_opciones' }, 
        (payload) => {
          handlePlatilloOpcionChange(payload);
        }
      )
      .subscribe();

    // Suscripción a relaciones platillo-opcion-valores
    const platilloOpcionValoresSubscription = supabase
      .channel('platillo-opcion-valores-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'platillo_opcion_valores' }, 
        (payload) => {
          handlePlatilloOpcionValorChange(payload);
        }
      )
      .subscribe();

    return () => {
      platillosSubscription.unsubscribe();
      categoriasSubscription.unsubscribe();
      opcionesSubscription.unsubscribe();
      opcionValoresSubscription.unsubscribe();
      platilloOpcionesSubscription.unsubscribe();
      platilloOpcionValoresSubscription.unsubscribe();
    };
  }

  // Manejadores de cambios en tiempo real
  function handlePlatilloChange(payload) {
    if (payload.eventType === 'INSERT') {
      setPlatillos(prev => prev.find(p => p.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setPlatillos(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setPlatillos(prev => prev.filter(item => item.id !== payload.old.id));
    }
  }

  function handleCategoriaChange(payload) {
    if (payload.eventType === 'INSERT') {
      setCategorias(prev => prev.find(c => c.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setCategorias(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setCategorias(prev => prev.filter(item => item.id !== payload.old.id));
      setPlatillos(prev => prev.map(platillo =>
        platillo.categoria_id === payload.old.id
          ? { ...platillo, categoria_id: null }
          : platillo
      ));
    }
  }

  function handleOpcionChange(payload) {
    if (payload.eventType === 'INSERT') {
      setOpciones(prev => prev.find(o => o.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setOpciones(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setOpciones(prev => prev.filter(item => item.id !== payload.old.id));
      setOpcionValores(prev => prev.filter(item => item.opcion_id !== payload.old.id));
      setPlatilloOpciones(prev => prev.filter(item => item.opcion_id !== payload.old.id));
    }
  }

  function handleOpcionValorChange(payload) {
    if (payload.eventType === 'INSERT') {
      setOpcionValores(prev => prev.find(v => v.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setOpcionValores(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setOpcionValores(prev => prev.filter(item => item.id !== payload.old.id));
      setPlatilloOpcionValores(prev => prev.filter(item => item.opcion_valor_id !== payload.old.id));
    }
  }

  function handlePlatilloOpcionChange(payload) {
    if (payload.eventType === 'INSERT') {
      setPlatilloOpciones(prev => prev.find(po => po.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setPlatilloOpciones(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setPlatilloOpciones(prev => prev.filter(item => item.id !== payload.old.id));
      setPlatilloOpcionValores(prev => prev.filter(item => item.platillo_opcion_id !== payload.old.id));
    }
  }

  function handlePlatilloOpcionValorChange(payload) {
    if (payload.eventType === 'INSERT') {
      setPlatilloOpcionValores(prev => prev.find(pov => pov.id === payload.new.id) ? prev : [...prev, payload.new]);
    } else if (payload.eventType === 'UPDATE') {
      setPlatilloOpcionValores(prev => prev.map(item =>
        item.id === payload.new.id ? { ...item, ...payload.new } : item
      ));
    } else if (payload.eventType === 'DELETE') {
      setPlatilloOpcionValores(prev => prev.filter(item => item.id !== payload.old.id));
    }
  }

  // Función para mostrar mensajes de éxito
  function showSuccess(message) {
    const mensajeLimpio = sanitizeText(message);
    setSuccessMessage(mensajeLimpio);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  }

  // Función para limpiar mensajes
  function clearMessages() {
    setErrors(null);
    setSuccessMessage(null);
  }

  async function loadAll() {
    setLoading(true);
    clearMessages();
    try {
      const [
        { data: cats, error: ec },
        { data: plats, error: ep },
        { data: ops, error: eo },
        { data: vals, error: ev },
        { data: pos, error: epo },
        { data: povs, error: epov }
      ] = await Promise.all([
        supabase.from("categorias").select("*").order("nombre", { ascending: true }),
        supabase.from("platillos").select("*").order("nombre", { ascending: true }),
        supabase.from("opciones").select("*").order("nombre", { ascending: true }),
        supabase.from("opcion_valores").select("*").order("valor", { ascending: true }),
        supabase.from("platillo_opciones").select("*"),
        supabase.from("platillo_opcion_valores").select("*")
      ]);
      
      if (ec || ep || eo || ev || epo || epov) throw ec || ep || eo || ev || epo || epov;

      // ✅ Sanitizar datos al cargar
      setCategorias((cats || []).map(cat => ({
        ...cat,
        nombre: sanitizeText(cat.nombre)
      })));
      
      setPlatillos((plats || []).map(plat => ({
        ...plat,
        nombre: sanitizeText(plat.nombre)
      })));
      
      setOpciones((ops || []).map(op => ({
        ...op,
        nombre: sanitizeText(op.nombre)
      })));
      
      setOpcionValores((vals || []).map(val => ({
        ...val,
        valor: sanitizeText(val.valor)
      })));
      
      setPlatilloOpciones(pos || []);
      setPlatilloOpcionValores(povs || []);
    } catch (err) {
      setErrors(err.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  // Helpers para obtener relaciones del platillo (ahora usa estado local)
  function getPlatilloOpciones(platillo_id) {
    const relaciones = platilloOpciones.filter(po => po.platillo_id === platillo_id);
    
    const byId = {};
    for (const row of relaciones) {
      const op = opciones.find((o) => o.id === row.opcion_id);
      byId[row.id] = { 
        id: row.id, 
        opcion_id: row.opcion_id, 
        opcion_nombre: sanitizeText(op?.nombre || "(sin nombre)"), 
        valores: [] 
      };
    }

    for (const row of platilloOpcionValores) {
      if (byId[row.platillo_opcion_id]) {
        const val = opcionValores.find((v) => v.id === row.opcion_valor_id);
        byId[row.platillo_opcion_id].valores.push({
          id: row.id,
          opcion_valor_id: row.opcion_valor_id,
          valor: sanitizeText(val?.valor || "(valor)"),
        });
      }
    }

    return Object.values(byId);
  }

  // CRUD Platillo - Actualizado para tiempo real
  function resetForm() {
    setForm(initialForm);
  }

  function validateForm() {
    const errs = [];
    if (!form.nombre.trim()) errs.push("El nombre es obligatorio.");
    if (form.precio === "" || isNaN(Number(form.precio))) errs.push("El precio debe ser numérico.");
    if (!form.categoria_id) errs.push("La categoría es obligatoria.");
    setErrors(errs.length ? errs.join(" ") : null);
    return errs.length === 0;
  }

  async function savePlatillo(e) {
    e?.preventDefault?.();
    if (!validateForm()) return;

    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar datos antes de guardar
      const datosLimpios = {
        nombre: sanitizeText(form.nombre),
        precio: Number(sanitizeNumber(form.precio)),
        categoria_id: form.categoria_id
      };

      if (form.id) {
        const { error } = await supabase
          .from("platillos")
          .update(datosLimpios)
          .eq("id", form.id);
        if (error) throw error;
        showSuccess("✅ Platillo actualizado con éxito");
      } else {
        const { error } = await supabase
          .from("platillos")
          .insert([datosLimpios]);
        if (error) throw error;
        showSuccess("✅ Platillo creado con éxito");
      }
      resetForm();
    } catch (err) {
      setErrors(err.message || "Error guardando platillo");
    } finally {
      setLoading(false);
    }
  }

  async function deletePlatillo(id) {
    if (!confirm("¿Eliminar este platillo? También se eliminarán sus relaciones.")) return;
    setLoading(true);
    clearMessages();
    try {
      // Eliminar relaciones primero
      const relaciones = platilloOpciones.filter(po => po.platillo_id === id);
      if (relaciones.length) {
        const poIds = relaciones.map((r) => r.id);
        
        // Eliminar valores de opciones
        const valoresAEliminar = platilloOpcionValores.filter(pov => 
          poIds.includes(pov.platillo_opcion_id)
        );
        
        for (const valor of valoresAEliminar) {
          await supabase.from("platillo_opcion_valores").delete().eq("id", valor.id);
        }
        
        // Eliminar opciones
        for (const relacion of relaciones) {
          await supabase.from("platillo_opciones").delete().eq("id", relacion.id);
        }
      }
      
      // Eliminar platillo
      const { error } = await supabase.from("platillos").delete().eq("id", id);
      if (error) throw error;
      showSuccess("✅ Platillo eliminado con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando platillo");
    } finally {
      setLoading(false);
    }
  }

  // CRUD Categorías - Actualizado para tiempo real
  function resetCategoryForm() {
    setCategoryForm(initialCategoryForm);
  }

  function validateCategoryForm() {
    const errs = [];
    if (!categoryForm.nombre.trim()) errs.push("El nombre de categoría es obligatorio.");
    setErrors(errs.length ? errs.join(" ") : null);
    return errs.length === 0;
  }

  async function saveCategory(e) {
    e?.preventDefault?.();
    if (!validateCategoryForm()) return;

    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar datos antes de guardar
      const datosLimpios = {
        nombre: sanitizeText(categoryForm.nombre),
        imagen: categoryForm.imagen
      };

      if (categoryForm.id) {
        const { error } = await supabase
          .from("categorias")
          .update(datosLimpios)
          .eq("id", categoryForm.id);
        if (error) throw error;
        showSuccess("✅ Categoría actualizada con éxito");
      } else {
        const { error } = await supabase
          .from("categorias")
          .insert([datosLimpios]);
        if (error) throw error;
        showSuccess("✅ Categoría creada con éxito");
      }
      resetCategoryForm();
    } catch (err) {
      setErrors(err.message || "Error guardando categoría");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCategory(id) {
    if (!confirm("¿Eliminar esta categoría? Los platillos de esta categoría quedarán sin categoría.")) return;
    setLoading(true);
    clearMessages();
    try {
      // Actualizar platillos que usan esta categoría
      const platillosConCategoria = platillos.filter(p => p.categoria_id === id);
      for (const platillo of platillosConCategoria) {
        await supabase.from("platillos")
          .update({ categoria_id: null })
          .eq("id", platillo.id);
      }
      
      // Eliminar la categoría
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
      showSuccess("✅ Categoría eliminada con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando categoría");
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setErrors("Por favor, selecciona un archivo de imagen válido");
      return;
    }

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors("La imagen debe ser menor a 2MB");
      return;
    }

    setLoading(true);
    clearMessages();
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `categorias/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setCategoryForm(prev => ({ ...prev, imagen: publicUrl }));
      showSuccess("✅ Imagen subida con éxito");
    } catch (err) {
      setErrors(err.message || "Error subiendo imagen");
    } finally {
      setLoading(false);
    }
  }

  // CRUD Opciones - Actualizado para tiempo real
  async function createOption(e) {
    e.preventDefault();
    if (!newOptionName.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar antes de guardar
      const nombreLimpio = sanitizeText(newOptionName.trim());
      const { error } = await supabase.from("opciones").insert([{ nombre: nombreLimpio }]);
      if (error) throw error;
      setNewOptionName("");
      showSuccess("✅ Opción creada con éxito");
    } catch (err) {
      setErrors(err.message || "Error creando opción");
    } finally {
      setLoading(false);
    }
  }

  async function updateOption() {
    if (!editingOption || !editingOption.nombre.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar antes de actualizar
      const nombreLimpio = sanitizeText(editingOption.nombre);
      const { error } = await supabase
        .from("opciones")
        .update({ nombre: nombreLimpio })
        .eq("id", editingOption.id);
      if (error) throw error;
      setEditingOption(null);
      showSuccess("✅ Opción actualizada con éxito");
    } catch (err) {
      setErrors(err.message || "Error actualizando opción");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOption(id) {
    if (!confirm("¿Eliminar esta opción? También se eliminarán todos sus valores y asignaciones.")) return;
    setLoading(true);
    clearMessages();
    try {
      // Eliminar valores de opción primero
      const valores = opcionValores.filter(v => v.opcion_id === id);
      for (const valor of valores) {
        await supabase.from("opcion_valores").delete().eq("id", valor.id);
      }
      
      // Eliminar relaciones con platillos
      const relaciones = platilloOpciones.filter(po => po.opcion_id === id);
      for (const relacion of relaciones) {
        // Eliminar valores de la relación
        const valoresRelacion = platilloOpcionValores.filter(pov => 
          pov.platillo_opcion_id === relacion.id
        );
        for (const valor of valoresRelacion) {
          await supabase.from("platillo_opcion_valores").delete().eq("id", valor.id);
        }
        // Eliminar la relación
        await supabase.from("platillo_opciones").delete().eq("id", relacion.id);
      }
      
      // Finalmente eliminar la opción
      const { error } = await supabase.from("opciones").delete().eq("id", id);
      if (error) throw error;
      showSuccess("✅ Opción eliminada con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando opción");
    } finally {
      setLoading(false);
    }
  }

  // CRUD Valores de Opción - Actualizado para tiempo real
  async function createOptionValue(e) {
    e.preventDefault();
    if (!newOptionValue.opcion_id || !newOptionValue.valor.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar antes de guardar
      const valorLimpio = sanitizeText(newOptionValue.valor.trim());
      const { error } = await supabase
        .from("opcion_valores")
        .insert([{ opcion_id: newOptionValue.opcion_id, valor: valorLimpio }]);
      if (error) throw error;
      setNewOptionValue({ opcion_id: "", valor: "" });
      showSuccess("✅ Valor de opción creado con éxito");
    } catch (err) {
      setErrors(err.message || "Error creando valor de opción");
    } finally {
      setLoading(false);
    }
  }

  async function updateOptionValue() {
    if (!editingValue || !editingValue.valor.trim()) return;
    setLoading(true);
    clearMessages();
    try {
      // ✅ Sanitizar antes de actualizar
      const valorLimpio = sanitizeText(editingValue.valor);
      const { error } = await supabase
        .from("opcion_valores")
        .update({ valor: valorLimpio })
        .eq("id", editingValue.id);
      if (error) throw error;
      setEditingValue(null);
      showSuccess("✅ Valor de opción actualizada con éxito");
    } catch (err) {
      setErrors(err.message || "Error actualizando valor");
    } finally {
      setLoading(false);
    }
  }

  async function deleteOptionValue(id) {
    if (!confirm("¿Eliminar este valor? Se eliminarán todas sus asignaciones a platillos.")) return;
    setLoading(true);
    clearMessages();
    try {
      // Eliminar relaciones con platillos primero
      const relaciones = platilloOpcionValores.filter(pov => pov.opcion_valor_id === id);
      for (const relacion of relaciones) {
        await supabase.from("platillo_opcion_valores").delete().eq("id", relacion.id);
      }
      
      // Eliminar el valor
      const { error } = await supabase.from("opcion_valores").delete().eq("id", id);
      if (error) throw error;
      showSuccess("✅ Valor de opción eliminado con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando valor");
    } finally {
      setLoading(false);
    }
  }

  // Asignar opcion a platillo - Actualizado para tiempo real
  async function attachOptionToDish(e) {
    e.preventDefault();
    if (!assign.platillo_id || !assign.opcion_id) return;
    setLoading(true);
    clearMessages();
    try {
      const { data, error } = await supabase
        .from("platillo_opciones")
        .insert([{ platillo_id: assign.platillo_id, opcion_id: assign.opcion_id }])
        .select("id")
        .single();
      if (error) throw error;
      setAssign((s) => ({ ...s, platillo_opcion_id: data.id }));
      showSuccess("✅ Opción asignada al platillo con éxito");
    } catch (err) {
      setErrors(err.message || "Error asignando opción");
    } finally {
      setLoading(false);
    }
  }

  // Asignar valor a una opción de un platillo - Actualizado para tiempo real
  async function attachOptionValueToDish(e) {
    e.preventDefault();
    if (!assign.platillo_opcion_id || !assign.opcion_valor_id) return;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.from("platillo_opcion_valores").insert([
        {
          platillo_opcion_id: assign.platillo_opcion_id,
          opcion_valor_id: assign.opcion_valor_id,
        },
      ]);
      if (error) throw error;
      setAssign((s) => ({ ...s, opcion_valor_id: "" }));
      showSuccess("✅ Valor asignado a la opción con éxito");
    } catch (err) {
      setErrors(err.message || "Error asignando valor");
    } finally {
      setLoading(false);
    }
  }

  // Eliminar asignaciones - Actualizado para tiempo real
  async function removeOptionFromDish(platilloOpcionId) {
    if (!confirm("¿Quitar esta opción del platillo?")) return;
    setLoading(true);
    clearMessages();
    try {
      // Primero eliminar los valores asociados
      const valores = platilloOpcionValores.filter(pov => pov.platillo_opcion_id === platilloOpcionId);
      for (const valor of valores) {
        await supabase.from("platillo_opcion_valores").delete().eq("id", valor.id);
      }
      
      // Luego eliminar la opción
      const { error } = await supabase.from("platillo_opciones").delete().eq("id", platilloOpcionId);
      if (error) throw error;
      showSuccess("✅ Opción removida del platillo con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando opción del platillo");
    } finally {
      setLoading(false);
    }
  }

  async function removeValueFromDish(platilloOpcionValorId) {
    if (!confirm("¿Quitar este valor del platillo?")) return;
    setLoading(true);
    clearMessages();
    try {
      const { error } = await supabase.from("platillo_opcion_valores").delete().eq("id", platilloOpcionValorId);
      if (error) throw error;
      showSuccess("✅ Valor removido de la opción con éxito");
    } catch (err) {
      setErrors(err.message || "Error eliminando valor del platillo");
    } finally {
      setLoading(false);
    }
  }

  // Para mostrar relaciones cuando expandes un platillo
  async function toggleExpand(platilloId) {
    setExpanded((prev) => ({ ...prev, [platilloId]: !prev[platilloId] }));
  }

  function onEdit(p) {
    setForm({
      id: p.id,
      nombre: sanitizeText(p.nombre || ""),
      precio: p.precio ?? "",
      categoria_id: p.categoria_id || "",
    });
    setActiveTab("platillos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onEditCategory(c) {
    setCategoryForm({
      id: c.id,
      nombre: sanitizeText(c.nombre || ""),
      imagen: c.imagen || "",
    });
    setActiveTab("categorias");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Utilidades UI
  const categoriaById = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c])),
    [categorias]
  );
  const opcionesById = useMemo(
    () => Object.fromEntries(opciones.map((o) => [o.id, o])),
    [opciones]
  );


  
  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6"
      style={{
        background: "linear-gradient(135deg, #000000 0%, #0d4922 80%)",
      }}
    >
      {/* BOTÓN PARA REGRESAR A RECEPCIÓN - Con React Router */}
      <div className="mb-4">
        <button
          onClick={() => navigate("/recepcion")}
          className="flex items-center text-emerald-300 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Volver a Recepción
        </button>
      </div>
      
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2 drop-shadow-md">Administración de Menú</h1>
        <p className="text-lg text-emerald-100 font-medium max-w-2xl mx-auto">
          Gestiona platillos, categorías, opciones y valores de cada platillo.
        </p>
      </header>

      {/* ALERTAS */}
      {errors && (
        <div className="mb-6 rounded-xl bg-red-900/30 backdrop-blur-sm border border-red-500/50 p-4 text-red-100">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Error</span>
          </div>
          <p className="mt-1 ml-7">{errors}</p>
        </div>
      )}

      {/* MENSAJES DE ÉXITO */}
      {successMessage && (
        <div className="mb-6 rounded-xl bg-green-900/30 backdrop-blur-sm border border-green-500/50 p-4 text-green-100">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Éxito</span>
          </div>
          <p className="mt-1 ml-7">{successMessage}</p>
        </div>
      )}

      {/* TABS DE NAVEGACIÓN */}
      <div className="mb-6 flex border-b border-emerald-800">
        <button
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeTab === "platillos" ? "bg-emerald-800 text-white" : "text-emerald-300 hover:bg-emerald-900/50"}`}
          onClick={() => setActiveTab("platillos")}
        >
          Platillos
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeTab === "categorias" ? "bg-emerald-800 text-white" : "text-emerald-300 hover:bg-emerald-900/50"}`}
          onClick={() => setActiveTab("categorias")}
        >
          Categorías
        </button>
        <button
          className={`px-4 py-2 font-medium rounded-t-lg transition-colors ${activeTab === "opciones" ? "bg-emerald-800 text-white" : "text-emerald-300 hover:bg-emerald-900/50"}`}
          onClick={() => setActiveTab("opciones")}
        >
          Opciones y Valores
        </button>
      </div>

      {/* FORM CATEGORÍA (solo visible en pestaña categorías) */}
      {activeTab === "categorias" && (
        <section className="mb-8 rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 p-5 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M17 10a7 7 0 11-14 0 7 7 0 0114 0zm-7-5a5 5 0 00-5 5c0 1.287.516 2.45 1.354 3.3a1 1 0 001.42-1.42A3 3 0 018 10a3 3 0 016 0 3 3 0 01-.774 2.02 1 1 0 001.418 1.42A5 5 0 0010 5z" clipRule="evenodd" />
            </svg>
            {categoryForm.id ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <form onSubmit={saveCategory} className="grid md:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-sm text-emerald-200 mb-1">Nombre</label>
              <input
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={categoryForm.nombre}
                onChange={(e) => handleCategoryFormChange('nombre', e.target.value)}
                placeholder="Ej. Pizzas"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-emerald-200 mb-1">Imagen</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadImage}
                  className="hidden"
                  id="category-image"
                />
                <label htmlFor="category-image" className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium cursor-pointer text-center flex-1">
                  {loading ? "Subiendo..." : "Seleccionar imagen"}
                </label>
                {categoryForm.imagen && (
                  <div className="relative">
                    <img src={categoryForm.imagen} alt="Vista previa" className="w-12 h-12 rounded-lg object-cover" />
                    <button
                      type="button"
                      onClick={() => setCategoryForm(prev => ({ ...prev, imagen: "" }))}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              <input
                type="text"
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 mt-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="O ingresa URL de imagen"
                value={categoryForm.imagen}
                onChange={(e) => handleCategoryFormChange('imagen', e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors flex-1"
              >
                {categoryForm.id ? "Guardar cambios" : "Crear categoría"}
              </button>
              {categoryForm.id && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="rounded-xl px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* FORM PLATILLO (solo visible en pestaña platillos) */}
      {activeTab === "platillos" && (
        <section className="mb-8 rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 p-5 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 005.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            {form.id ? "Editar platillo" : "Nuevo platillo"}
          </h2>
          <form onSubmit={savePlatillo} className="grid md:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <label className="text-sm text-emerald-200 mb-1">Nombre</label>
              <input
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={form.nombre}
                onChange={(e) => handleFormChange('nombre', e.target.value)}
                placeholder="Ej. Pizza Margarita"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-emerald-200 mb-1">Precio</label>
              <input
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={form.precio}
                onChange={(e) => handleFormChange('precio', sanitizeNumber(e.target.value))}
                placeholder="Ej. 85.00"
                inputMode="decimal"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-emerald-200 mb-1">Categoría</label>
              <select
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={form.categoria_id}
                onChange={(e) => handleFormChange('categoria_id', e.target.value)}
              >
                <option value="">Selecciona…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors flex-1"
              >
                {form.id ? "Guardar cambios" : "Crear platillo"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {/* OPCIONES Y VALORES (solo visible en pestaña opciones) */}
      {activeTab === "opciones" && (
        <section className="mb-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 p-5 shadow-lg">
            <h3 className="font-semibold text-white mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Gestión de Opciones
            </h3>
            
            {/* Formulario para crear/editar opciones */}
            <form onSubmit={editingOption ? (e) => { e.preventDefault(); updateOption(); } : createOption} className="flex gap-2 mb-4">
              <input
                className="flex-1 rounded-xl bg-gray-900/50 border border-gray-700 text-white p-3 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={editingOption ? editingOption.nombre : newOptionName}
                onChange={(e) => editingOption 
                  ? setEditingOption({...editingOption, nombre: e.target.value})
                  : handleNewOptionNameChange(e.target.value)}
                placeholder="Ej. Tamaño"
              />
              <button className="rounded-xl px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors" disabled={loading}>
                {editingOption ? "Actualizar" : "Crear"}
              </button>
              {editingOption && (
                <button
                  type="button"
                  onClick={() => setEditingOption(null)}
                  className="rounded-xl px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
              )}
            </form>

            {/* Lista de opciones */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {opciones.map((opcion) => (
                <div key={opcion.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-900/50">
                  <span className="text-white">{opcion.nombre}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingOption(opcion)}
                      className="p-1 text-emerald-400 hover:text-emerald-300"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteOption(opcion.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 p-5 shadow-lg">
            <h3 className="font-semibold text-white mb-3 flex items-center">
              <svg className="w-4 h-4 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Gestión de Valores
            </h3>

            {/* Formulario para crear/editar valores */}
            <form onSubmit={editingValue ? (e) => { e.preventDefault(); updateOptionValue(); } : createOptionValue} className="grid grid-cols-3 gap-2 mb-4">
              <select
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={editingValue ? opcionValores.find(v => v.id === editingValue.id)?.opcion_id : newOptionValue.opcion_id}
                onChange={(e) => editingValue 
                  ? null // No permitir cambiar la opción al editar
                  : handleNewOptionValueChange('opcion_id', e.target.value)}
                disabled={!!editingValue}
              >
                <option value="">Opción…</option>
                {opciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
              <input
                className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                value={editingValue ? editingValue.valor : newOptionValue.valor}
                onChange={(e) => editingValue 
                  ? setEditingValue({...editingValue, valor: e.target.value})
                  : handleNewOptionValueChange('valor', e.target.value)}
                placeholder="Ej. Grande"
              />
              <button className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors" disabled={loading}>
                {editingValue ? "Actualizar" : "Agregar"}
              </button>
              {editingValue && (
                <button
                  type="button"
                  onClick={() => setEditingValue(null)}
                  className="rounded-xl px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors col-span-3 mt-2"
                >
                  Cancelar
                </button>
              )}
            </form>

            {/* Lista de valores agrupados por opción */}
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {opciones.map((opcion) => {
                const valores = opcionValores.filter(v => v.opcion_id === opcion.id);
                if (valores.length === 0) return null;
                
                return (
                  <div key={opcion.id} className="bg-gray-900/50 rounded-lg p-2">
                    <div className="text-sm font-medium text-emerald-300 mb-1">{opcion.nombre}</div>
                    <div className="space-y-1">
                      {valores.map((valor) => (
                        <div key={valor.id} className="flex items-center justify-between pl-2">
                          <span className="text-white">{valor.valor}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingValue(valor)}
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteOptionValue(valor.id)}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ASIGNACIONES (solo visible en pestaña platillos) */}
      {activeTab === "platillos" && (
        <section className="mb-8 rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 p-5 shadow-lg">
          <h3 className="font-semibold text-white mb-4 flex items-center">
            <svg className="w-4 h-4 mr-2 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Asignaciones
          </h3>

          {/* Asignar opción a platillo */}
          <form onSubmit={attachOptionToDish} className="grid md:grid-cols-4 gap-3 mb-4">
            <select
              className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={assign.platillo_id}
              onChange={(e) => setAssign((s) => ({ ...s, platillo_id: e.target.value, platillo_opcion_id: "" }))}
            >
              <option value="">Platillo…</option>
              {platillos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>

            <select
              className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={assign.opcion_id}
              onChange={(e) => setAssign((s) => ({ ...s, opcion_id: e.target.value }))}
            >
              <option value="">Opción…</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>

            <button className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors" disabled={loading}>
              Asignar opción
            </button>

            {assign.platillo_opcion_id && (
              <div className="text-xs text-emerald-300 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Asignación creada: {assign.platillo_opcion_id}
              </div>
            )}
          </form>

          {/* Asignar valor a una opción-asignada */}
          <form onSubmit={attachOptionValueToDish} className="grid md:grid-cols-4 gap-3">
            <input
              className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={assign.platillo_opcion_id}
              onChange={(e) => setAssign((s) => ({ ...s, platillo_opcion_id: e.target.value }))}
              placeholder="ID platillo_opcion (si ya lo conoces)"
            />
            <select
              className="rounded-xl bg-gray-900/50 border border-gray-700 text-white p-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              value={assign.opcion_valor_id}
              onChange={(e) => setAssign((s) => ({ ...s, opcion_valor_id: e.target.value }))}
            >
              <option value="">Valor…</option>
              {opcionValores.map((v) => (
                <option key={v.id} value={v.id}>
                  {opcionesById[v.opcion_id]?.nombre} — {v.valor}
                </option>
              ))}
            </select>
            <button className="rounded-xl px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50 transition-colors" disabled={loading}>
              Asignar valor
            </button>
            <div className="text-xs text-emerald-300">
              <span className="font-medium">Tip:</span> puedes obtener el <code className="bg-black/30 px-1 py-0.5 rounded">platillo_opcion_id</code> expandiendo un platillo en el listado.
            </div>
          </form>
        </section>
      )}

      {/* BUSCADOR */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>  
          </div>
          <input
            className="rounded-xl bg-gray-900/50 border border-gray-700 text-white pl-10 p-3 w-full focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            placeholder={`Buscar por ${activeTab === 'categorias' ? 'nombre de categoría' : 'nombre o categoría'}…`}
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <button onClick={loadAll} className="rounded-xl px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors" disabled={loading}>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 a1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* LISTADO (depende de la pestaña activa) */}
      {activeTab === "platillos" && (
        <section className="rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 overflow-hidden shadow-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-black/50">
              <tr>
                <th className="text-left p-4 text-emerald-400 font-medium">Platillo</th>
                <th className="text-left p-4 text-emerald-400 font-medium">Categoría</th>
                <th className="text-left p-4 text-emerald-400 font-medium">Precio</th>
                <th className="text-left p-4 text-emerald-400 font-medium w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlatillos.map((p) => (
                <RowPlatillo
                  key={p.id}
                  p={p}
                  categoria={categoriaById[p.categoria_id]?.nombre || "—"}
                  onEdit={() => onEdit(p)}
                  onDelete={() => deletePlatillo(p.id)}
                  expanded={!!expanded[p.id]}
                  onToggle={() => toggleExpand(p.id)}
                  fetchRelations={() => getPlatilloOpciones(p.id)}
                  removeOptionFromDish={removeOptionFromDish}
                  removeValueFromDish={removeValueFromDish}
                />
              ))}
              {!filteredPlatillos.length && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    No hay platillos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {activeTab === "categorias" && (
        <section className="rounded-2xl bg-black/30 backdrop-blur-sm border border-emerald-800/50 overflow-hidden shadow-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-black/50">
              <tr>
                <th className="text-left p-4 text-emerald-400 font-medium">Imagen</th>
                <th className="text-left p-4 text-emerald-400 font-medium">Categoría</th>
                <th className="text-left p-4 text-emerald-400 font-medium w-48">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategorias.map((c) => (
                <tr key={c.id} className="border-t border-emerald-900/50">
                  <td className="p-4">
                    {c.imagen ? (
                      <img src={c.imagen} alt={c.nombre} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-white font-medium">{c.nombre}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => onEditCategory(c)} className="rounded-xl px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm">
                        Editar
                      </button>
                      <button onClick={() => deleteCategory(c.id)} className="rounded-xl px-3 py-1 bg-red-800/40 hover:bg-red-700/50 text-red-200 transition-colors text-sm">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCategorias.length && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-400">
                    No hay categorías para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-emerald-700 text-white px-4 py-3 shadow-lg flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Procesando…
        </div>
      )}
    </div>
  );
}

function RowPlatillo({ p, categoria, onEdit, onDelete, expanded, onToggle, fetchRelations, removeOptionFromDish, removeValueFromDish }) {
  const [loading, setLoading] = useState(false);
  const [rel, setRel] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!expanded) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchRelations();
        setRel(data);
      } catch (e) {
        setErr(e.message || "Error cargando relaciones");
      } finally {
        setLoading(false);
      }
    })();
  }, [expanded]);

  return (
    <>
      <tr className="border-t border-emerald-900/50">
        <td className="p-4">
          <button onClick={onToggle} className="font-medium text-white hover:text-emerald-300 transition-colors flex items-center">
            {expanded ? (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {p.nombre}
          </button>
        </td>
        <td className="p-4 text-emerald-200">{categoria}</td>
        <td className="p-4 text-emerald-300 font-medium">Q {Number(p.precio).toFixed(2)}</td>
        <td className="p-4">
          <div className="flex gap-2">
            <button onClick={onEdit} className="rounded-xl px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white transition-colors text-sm">
              Editar
            </button>
            <button onClick={onDelete} className="rounded-xl px-3 py-1 bg-red-800/40 hover:bg-red-700/50 text-red-200 transition-colors text-sm">
              Eliminar
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-black/20">
          <td colSpan={4} className="p-4">
            {loading && (
              <div className="text-emerald-300 flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-300" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando opciones…
              </div>
            )}
            {err && <div className="text-red-300">{err}</div>}
            {!loading && !err && (
              <div className="grid gap-3">
                {(rel || []).map((r) => (
                  <div key={r.id} className="rounded-xl bg-black/30 border border-emerald-900/50 p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-sm font-medium text-emerald-300">
                        Opción: <span className="font-semibold">{r.opcion_nombre}</span>{" "}
                        <span className="text-xs text-emerald-400/70 ml-2">ID: {r.id}</span>
                      </div>
                      <button 
                        onClick={() => removeOptionFromDish(r.id)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center"
                      >
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Quitar
                      </button>
                    </div>
                    <div className="text-sm mt-2 text-white">
                      Valores asignados:{" "}
                      {r.valores.length ? (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {r.valores.map((v) => (
                            <span key={v.id} className="inline-flex items-center rounded-full bg-emerald-600/20 text-emerald-300 px-3 py-1 text-xs font-medium">
                              {v.valor}
                              <button 
                                onClick={() => removeValueFromDish(v.id)}
                                className="ml-2 text-red-300 hover:text-red-200"
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                ))}
                {!rel?.length && <div className="text-gray-400 text-center py-3">Sin opciones asignadas.</div>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}