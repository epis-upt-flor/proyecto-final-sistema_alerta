import axios from "axios";

const api = axios.create({
  baseURL: "http://18.225.31.96:5000/api", 
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para agregar el token si existe
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (!config.headers) config.headers = {};
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // AGREGAR ESTO para no tener el error de no respuesta al listar dispositivos ni buscar por dni a victimas
  config.headers["ngrok-skip-browser-warning"] = "true";
  return config;
});

export default api;