import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { User } from "../../types/user";

interface RegistrarUsuarioRequest {
  dni: string;
  nombre: string;
  email: string;
  password: string;
  role: "patrullero" | "operador";
}

interface EditarUsuarioRequest {
  uid: string;
  dni: string;
  nombre: string;
  email: string;
  role: "patrullero" | "operador";
  estado: "activo" | "inactivo";
}

interface ListarUsuariosResponse {
  data: User[];
  filtroRole: string | null;
  limite: number;
  success: boolean;
  total: number;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showRegistroForm, setShowRegistroForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  // Estado del formulario de registro
  const [formData, setFormData] = useState<RegistrarUsuarioRequest>({
    dni: "",
    nombre: "",
    email: "",
    password: "",
    role: "operador"
  });
  
  // Estado del formulario de edición
  const [editFormData, setEditFormData] = useState<EditarUsuarioRequest>({
    uid: "",
    dni: "",
    nombre: "",
    email: "",
    role: "operador",
    estado: "activo"
  });
  
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cargar usuarios existentes
  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setLoadingUsers(true);
    try {
      console.log("Cargando usuarios...");
      const res = await api.get<ListarUsuariosResponse>("/user/listar");
      console.log("Respuesta del backend:", res);
      console.log("Datos recibidos:", res.data);
      
      // El backend devuelve { data: Array, success: true, total: number, ... }
      if (res.data && res.data.data && Array.isArray(res.data.data)) {
        console.log("Usuarios encontrados:", res.data.data.length);
        
        // Filtrar solo operadores y patrulleros (excluir víctimas y admins)
        const usuariosFiltrados = res.data.data.filter((user: User) => 
          user.role === 'operador' || user.role === 'patrullero'
        );
        
        console.log("Usuarios filtrados (operadores y patrulleros):", usuariosFiltrados.length);
        console.log("Estados de usuarios:", usuariosFiltrados.map(u => ({dni: u.dni, estado: u.estado})));
        setUsers(usuariosFiltrados);
      } else {
        console.warn("Estructura de respuesta inesperada:", res.data);
        setUsers([]);
      }
    } catch (err: any) {
      console.error("Error cargando usuarios:", err);
      console.error("Status:", err?.response?.status);
      console.error("Data:", err?.response?.data);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleEditUser = (user: User) => {
    setEditFormData({
      uid: user.uid,
      dni: user.dni,
      nombre: user.nombre + (user.apellido ? ' ' + user.apellido : ''),
      email: user.email,
      role: user.role as "patrullero" | "operador",
      estado: (user.estado === 'inactivo' ? 'inactivo' : 'activo') as "activo" | "inactivo"
    });
    setShowEditForm(true);
    setShowRegistroForm(false); // Cerrar formulario de registro si está abierto
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await api.post("/user/registrar", formData);
      setSuccess("Usuario registrado exitosamente");
      
      // Limpiar formulario
      setFormData({
        dni: "",
        nombre: "",
        email: "",
        password: "",
        role: "operador"
      });
      
      // Recargar lista de usuarios
      cargarUsuarios();
      
      // Ocultar formulario después de 2 segundos
      setTimeout(() => {
        setShowRegistroForm(false);
        setSuccess("");
      }, 2000);
      
    } catch (err: any) {
      setError(err?.response?.data?.mensaje || "Error al registrar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setEditLoading(true);

    try {
      const response = await api.put("/user/editar", editFormData);
      setSuccess("Usuario editado exitosamente");
      
      // Recargar lista de usuarios
      cargarUsuarios();
      
      // Ocultar formulario después de 2 segundos
      setTimeout(() => {
        setShowEditForm(false);
        setSuccess("");
      }, 2000);
      
    } catch (err: any) {
      setError(err?.response?.data?.mensaje || "Error al editar usuario");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="user-management-area">
      {/* Lista de usuarios existentes */}
      <div className="user-list-section">
        <div className="card">
          <h3 className="section-title">Operadores y Patrulleros</h3>
          
          <div className="user-table-container">
            <table className="user-table">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map(user => (
                    <tr key={user.uid}>
                      <td>{user.dni}</td>
                      <td>{user.nombre} {user.apellido}</td>
                      <td>
                        <span className={`role-badge ${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${user.estado === 'inactivo' ? 'status-inactive' : 'status-active'}`}>
                          {user.estado === 'inactivo' ? 'Inactivo' : 'Activo'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="edit-user-btn"
                          onClick={() => handleEditUser(user)}
                          title="Editar usuario"
                        >
                          ✏️
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>
                      No hay operadores ni patrulleros registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <button 
            className="register-user-btn"
            onClick={() => {
              setShowRegistroForm(!showRegistroForm);
              setShowEditForm(false); // Cerrar formulario de edición si está abierto
            }}
          >
            {showRegistroForm ? "Cancelar Registro" : "Registrar Nuevo Usuario"}
          </button>
        </div>
      </div>

      {/* Formulario de edición (se muestra condicionalmente) */}
      {showEditForm && (
        <div className="user-register-section">
          <div className="card">
            <h3 className="section-title">Editar Usuario</h3>
            <form onSubmit={handleEditSubmit} className="user-register-form">
              <div className="form-group">
                <label htmlFor="edit-dni">DNI</label>
                <input
                  type="text"
                  id="edit-dni"
                  name="dni"
                  value={editFormData.dni}
                  onChange={handleEditInputChange}
                  required
                  maxLength={8}
                  pattern="[0-9]{8}"
                  placeholder="12345678"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-nombre">Nombre Completo</label>
                <input
                  type="text"
                  id="edit-nombre"
                  name="nombre"
                  value={editFormData.nombre}
                  onChange={handleEditInputChange}
                  required
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-email">Correo Electrónico</label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditInputChange}
                  required
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-role">Rol</label>
                <select
                  id="edit-role"
                  name="role"
                  value={editFormData.role}
                  onChange={handleEditInputChange}
                  required
                >
                  <option value="operador">Operador</option>
                  <option value="patrullero">Patrullero</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-estado">Estado</label>
                <select
                  id="edit-estado"
                  name="estado"
                  value={editFormData.estado}
                  onChange={handleEditInputChange}
                  required
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>

              <div className="form-buttons">
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={editLoading}
                >
                  {editLoading ? "Guardando..." : "Guardar Cambios"}
                </button>
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowEditForm(false)}
                >
                  Cancelar
                </button>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
            </form>
          </div>
        </div>
      )}

      {/* Formulario de registro (se muestra condicionalmente) */}
      {showRegistroForm && (
        <div className="user-register-section">
          <div className="card">
            <h3 className="section-title">Registrar Usuario</h3>
            <form onSubmit={handleSubmit} className="user-register-form">
              <div className="form-group">
                <label htmlFor="dni">DNI</label>
                <input
                  type="text"
                  id="dni"
                  name="dni"
                  value={formData.dni}
                  onChange={handleInputChange}
                  required
                  maxLength={8}
                  pattern="[0-9]{8}"
                  placeholder="12345678"
                />
              </div>

              <div className="form-group">
                <label htmlFor="nombre">Nombre Completo</label>
                <input
                  type="text"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  required
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="form-group">
                <label htmlFor="role">Rol</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  required
                >
                  <option value="operador">Operador</option>
                  <option value="patrullero">Patrullero</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading}
              >
                {loading ? "Registrando..." : "Registrar Usuario"}
              </button>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;