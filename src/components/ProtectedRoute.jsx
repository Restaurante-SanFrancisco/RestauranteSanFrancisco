// src/components/ProtectedRoute.jsx
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ProtectedRoute({ children, allowedRoles }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSessionAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        const id = session.user.id;
        setUserId(id);

        // Verificar si está activo y obtener rol
        const { data: info, error } = await supabase
          .from("infousuario")
          .select("activo, rol")
          .eq("id", id)
          .single();

        if (error || !info || info.activo === false) {
          await supabase.auth.signOut();
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        setUserRole(info.rol);
        setIsAuthenticated(true);
        setIsLoading(false);

      } catch (error) {
        setIsLoading(false);
      }
    };

    checkSessionAndRole();
  }, [allowedRoles]);
  useEffect(() => {
    if (!userId) return;

    // Suscripción en tiempo real para detectar si el admin lo desactiva
    const channel = supabase
      .channel("user-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "infousuario",
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.new.activo === false) {
            await supabase.auth.signOut();
            navigate("/", { replace: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, navigate]);

  if (isLoading) {
    return <div className="text-center mt-10">Cargando...</div>;
  }

  // Si no está autenticado
  if (!isAuthenticated) return <Navigate to="/" replace />;

  // Si el rol del usuario no está dentro de los permitidos
  if (allowedRoles && !allowedRoles.some(role => role.toLowerCase() === userRole.toLowerCase())) {
    return <Navigate to="/" replace />;
  }

  return children;
}