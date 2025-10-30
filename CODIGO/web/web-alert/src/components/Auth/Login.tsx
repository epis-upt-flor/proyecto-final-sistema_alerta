import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebase";
import api from "../../services/api"; // Axios instance
import { useNavigate } from "react-router-dom";

type AuthResponse = {
  token: string;
  user: {
    uid: string;
    email: string;
    role: "admin" | "operator";
  };
};

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (user) {
        const token = await user.getIdToken();

        console.log("[FRONTEND] Enviando al backend:", { token });

        // 3. Envía el token al backend para validación
        const res = await api.post<AuthResponse>("/auth/firebase", { token });

        if (res.data && res.data.user && res.data.token) {
          const allowedRoles = ["admin", "operator"];
          if (allowedRoles.includes(res.data.user.role)) {
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user));
            navigate("/dashboard");
          } else {
            setError("No tienes permisos para acceder.");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
          }
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Error en la autenticación.");
        }
      }
    } catch (err: any) {
      setError("Usuario o contraseña incorrectos.");
      console.error("[FRONTEND] Error al loguear:", err);
      // Limpia el localStorage si hubo error
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  return (
    <form onSubmit={handleLogin} className="login-form">
      <h2>Iniciar Sesión</h2>
      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />
      <button type="submit">Entrar</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};

export default Login;