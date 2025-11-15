// src/utils/sanitize.js
import DOMPurify from 'dompurify';

// =============================
// Configuración DOMPurify
// =============================

// Configuración básica para texto sin tags
const configBasico = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  FORBID_TAGS: ['script', 'iframe', 'style', 'link', 'meta', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
};

// Configuración para reportes (permite estilo pero filtrado)
const configReportes = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'br', 'p', 'span', 'div',
    'table', 'tr', 'td', 'th', 'thead', 'tbody',
    'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li'
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'border', 'cellpadding', 'cellspacing', 'width',
    'align', 'id'
  ],
  ALLOW_STYLE: true,
  FORBID_TAGS: ['script', 'iframe', 'link', 'meta', 'form', 'base'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onkeypress']
};

// Filtrar estilos inseguros (para evitar CSS injection)
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style') {
    // Lista de propiedades CSS permitidas (expande para diseño)
    const allowedProperties = [
      'color', 'background', 'background-color', 'padding', 'margin', 'border',
      'font-size', 'font-weight', 'text-align', 'display',
      'grid-template-columns', 'gap', 'width', 'height', 'border-radius'
    ];

    // Expresiones peligrosas a bloquear
    const dangerousPatterns = [
      /url\s*\(.*javascript:/gi,
      /expression\(/gi,
      /behavior\s*:/gi,
      /-\moz-binding/gi
    ];

    // Verificar patrones peligrosos
    const hasDangerousPattern = dangerousPatterns.some(pattern =>
      pattern.test(data.attrValue)
    );

    if (hasDangerousPattern) {
      data.keepAttr = false;
      return;
    }

    // Filtrar propiedades CSS no permitidas
    const styleDeclarations = data.attrValue.split(';');
    const safeDeclarations = styleDeclarations.filter(declaration => {
      const [property] = declaration.split(':').map(part => part.trim());
      return allowedProperties.some(allowed =>
        property && property.toLowerCase().includes(allowed.toLowerCase())
      );
    });

    data.attrValue = safeDeclarations.join('; ');
  }
});

// =============================
// Funciones de sanitización
// =============================

// Texto simple
export const sanitizeText = (text, options = {}) => {
  const { collapseSpaces = false, trim = false } = options;
  if (text === null || text === undefined) return '';
  // Convertir a string y sanitizar
  let sanitized = DOMPurify.sanitize(String(text), configBasico);

  // Normalizar NBSP a espacio regular
  sanitized = sanitized.replace(/\u00A0/g, ' ');

  // Opcional: colapsar múltiples espacios en uno solo si el caller lo solicita
  if (collapseSpaces) {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  // Si caller solicita recortar, recortar; por defecto NO recorta (permite espacios mientras escribe)
  return trim ? sanitized.trim() : sanitized;
};

// Números (precios con decimales o enteros)
export const sanitizeNumber = (input, allowDecimals = true) => {
  if (input === null || input === undefined || input === '') return 0;

  // Convertir a string por seguridad
  let value = String(input);

  // Regex según el caso
  const regex = allowDecimals
    ? /^[0-9]+(\.[0-9]{1,2})?$/   // 2 decimales máximo
    : /^[0-9]+$/;                 // solo enteros

  // Si coincide, devolver como número
  if (regex.test(value)) {
    return allowDecimals ? parseFloat(value) : parseInt(value, 10);
  }

  // Si no coincide, limpiar manualmente
  let clean = value.replace(/[^0-9.]/g, '');
  if (!allowDecimals) clean = clean.replace('.', '');

  const num = allowDecimals ? parseFloat(clean) : parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
};

// HTML estricto
export const sanitizeHtml = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), configBasico);
};

// HTML para reportes (con estilos filtrados)
export const sanitizeHtmlReportes = (html) => {
  if (!html) return '';
  return DOMPurify.sanitize(String(html), configReportes);
};

// Email seguro
export const sanitizeEmail = (email) => {
  if (!email) return '';
  
  const cleanEmail = String(email)
    .replace(/[<>]/g, '')
    .replace(/[^a-zA-Z0-9@._-]/g, '')
    .trim();

  // ✅ Descomenta y corrige esta parte
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(cleanEmail) ? cleanEmail.substring(0, 254) : cleanEmail; 
};

// Sanitizar objeto completo (con mapa de campos críticos)
export const sanitizeObject = (obj) => {
  if (!obj) return {};

  const clean = {};
  for (const key in obj) {
    const value = obj[key];

    if (value === null || value === undefined) {
      clean[key] = value;
    } else if (typeof value === 'string') {
      if (key.match(/nota|observacion|comentario|descripcion/i)) {
        clean[key] = sanitizeHtml(value);
      } else if (key.match(/email|correo/i)) {
        clean[key] = sanitizeEmail(value);
      } else if (key.match(/reporte_html/i)) {
        // CORREGIDO: Permite el HTML del reporte con estilos
        clean[key] = sanitizeHtmlReportes(value);
      } else {
        clean[key] = sanitizeText(value);
      }
    } else {
      clean[key] = value;
    }
  }
  return clean;
};


export const sanitizeUrl = (url) => {
  // Limpia con sanitizeText y permite sólo http(s) o data:image
  const cleaned = sanitizeText(String(url || ""));
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(cleaned)) return cleaned;
  return "";
};

export const normalizeOpciones = (opciones) => {
  // Acepta arrays de {opcion, valor} o objetos {clave: valor}
  if (!opciones) return [];
  if (Array.isArray(opciones)) {
    return opciones.map((opt) => ({
      opcion: sanitizeText(opt?.opcion ?? opt?.name ?? ""),
      valor: sanitizeText(opt?.valor ?? opt?.value ?? ""),
    }));
  }
  if (typeof opciones === "object") {
    return Object.entries(opciones).map(([k, v]) => ({
      opcion: sanitizeText(k),
      valor: sanitizeText(String(v)),
    }));
  }
  return [];
};
