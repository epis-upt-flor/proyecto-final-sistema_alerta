import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { User } from "../../types/user";

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api.get<User[]>("/users").then(res => setUsers(res.data));
  }, []);

  return (
    <div>
      <h3>Gestión de Usuarios</h3>
      <ul>
        {users.map(user => (
          <li key={user.uid}>
            {user.nombre} {user.apellido} ({user.dni}) - {user.role}
          </li>
        ))}
      </ul>
      <button>Crear Usuario</button>
    </div>
  );
};

export default UserManagement;