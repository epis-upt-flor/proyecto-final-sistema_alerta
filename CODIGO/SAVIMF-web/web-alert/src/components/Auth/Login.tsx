import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../services/firebase";
import api from "../../services/api"; // Axios instance
import { useNavigate } from "react-router-dom";
import "./Login.css"; // Importar estilos

type AuthResponse = {
  token: string;
  user: {
    uid: string;
    email: string;
    role: "admin" | "operador";
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

        const res = await api.post<AuthResponse>("/auth/firebase", { token });

        if (res.data && res.data.user && res.data.token) {
          const allowedRoles = ["admin", "operador"];
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
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  };

  return (
    <div className="login-page">
      <div className="login-image"></div>
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <h2 className="login-title">Sistema de Alerta</h2>
          <p className="login-subtitle">Contra la Violencia de la Mujer y el Grupo Familiar</p>
          <input
            type="email"
            placeholder="Correo Electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-input"
          />
          <button type="submit" className="login-button">Iniciar Sesión</button>
          {error && <p className="login-error">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;