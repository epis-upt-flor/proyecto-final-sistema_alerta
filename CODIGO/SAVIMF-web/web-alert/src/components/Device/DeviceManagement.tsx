import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { Device } from "../../types/device";
import { User } from "../../types/user";

type RegistrarResponse = { mensaje: string };

const hex16 = /^[A-Fa-f0-9]{16}$/;
const hex32 = /^[A-Fa-f0-9]{32}$/;

const DeviceManagement: React.FC = () => {
  // --- Registro ---
  const [form, setForm] = useState({
    DeviceId: "",
    DevEui: "",
    JoinEui: "",
    AppKey: "",
  });
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // --- Lista y vinculación ---
  const [devices, setDevices] = useState<Device[]>([]);
  const [dni, setDni] = useState("");
  const [victima, setVictima] = useState<User | null>(null);
  const [deviceToLink, setDeviceToLink] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // 1. Cargar la lista de dispositivos
  const cargarDispositivos = async () => {
    try {
      const res = await api.get<Device[]>("/device/listar");
      if (Array.isArray(res.data)) {
        setDevices(res.data);
      } else {
        setDevices([]);
        setError("La respuesta del backend no es un array.");
      }
    } catch (err: any) {
      setDevices([]);
      setError("Error cargando dispositivos: " + (err?.response?.status || "") + " " + (err?.toString() || ""));
    }
  };

  useEffect(() => {
    cargarDispositivos();
  }, []);

  // --- Registrar Dispositivo ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    if (!hex16.test(form.DevEui)) return "DevEUI debe tener 16 caracteres hexadecimales.";
    if (!hex16.test(form.JoinEui)) return "JoinEUI debe tener 16 caracteres hexadecimales.";
    if (!hex32.test(form.AppKey)) return "AppKey debe tener 32 caracteres hexadecimales.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    setRegSuccess("");

    const validationErr = validateForm();
    if (validationErr) {
      setRegError(validationErr);
      return;
    }

    setLoading(true);

    try {
      const res = await api.post<RegistrarResponse>("/device/registrar", form);
      setRegSuccess(res.data.mensaje || "Dispositivo registrado correctamente.");
      setForm({ DeviceId: "", DevEui: "", JoinEui: "", AppKey: "" });
      cargarDispositivos(); // Refresca la lista al registrar
    } catch (err: any) {
      setRegError(err?.response?.data?.mensaje || "Error desconocido al registrar.");
    } finally {
      setLoading(false);
    }
  };

  // --- Buscar víctima por DNI ---
  const buscarVictima = async () => {
    setVictima(null);
    setError("");
    setSuccess("");
    if (!dni) {
      setError("Ingresa un DNI.");
      return;
    }
    try {
      const res = await api.get<User>(`/user/buscar?dni=${dni}`);
      console.log("RESPUESTA DE BACKEND AL BUSCAR VÍCTIMA:", res.data); // <-- AGREGA ESTE LOG
      setVictima(res.data);
    } catch (err: any) {
      setVictima(null);
      setError("No se encontró la víctima o error en la búsqueda.");
    }
  };

  // --- Vincular dispositivo a víctima ---
  const vincular = async () => {
    setError("");
    setSuccess("");
    if (!victima || !deviceToLink) {
      setError("Selecciona víctima y dispositivo.");
      return;
    }
    try {
      await api.post("/user/vincular-dispositivo", {
        dni: victima.dni,
        deviceId: deviceToLink,
      });
      setSuccess("Dispositivo vinculado correctamente.");
      setDeviceToLink(null);
      cargarDispositivos(); // Refresca lista
      buscarVictima(); // Refresca datos víctima
    } catch (err: any) {
      setError("Error al vincular: " + (err?.response?.data?.mensaje || ""));
    }
  };

  return (
    <div className="device-management-area">
      {/* Panel izquierdo: Lista + Registro */}
      <div className="device-management-left">
        {/* --- LISTA DE DISPOSITIVOS --- */}
        <div className="device-list-card card">
          <h2 className="device-list-title">Lista de Dispositivos</h2>
          <table className="device-table">
            <thead>
              <tr>
                <th>DeviceId</th>
                <th>DevEui</th>
                <th>¿Vinculado?</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(devices) && devices.length > 0 ? (
                devices.map(device => (
                  <tr key={device.deviceId}>
                    <td>{device.deviceId}</td>
                    <td>{device.devEui}</td>
                    <td>{device.vinculado || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No hay dispositivos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* --- REGISTRAR DISPOSITIVO --- */}
        <div className="device-form-container card">
          <div className="device-form-title">Registrar Dispositivo en TTS</div>
          <form onSubmit={handleSubmit} className="device-form" autoComplete="off">
            <input className="device-input" name="DeviceId" placeholder="Device ID" value={form.DeviceId} onChange={handleChange} required />
            <input className="device-input" name="DevEui" placeholder="DevEUI (16 hex)" value={form.DevEui} onChange={handleChange} required maxLength={16} />
            <input className="device-input" name="JoinEui" placeholder="JoinEUI (16 hex)" value={form.JoinEui} onChange={handleChange} required maxLength={16} />
            <input className="device-input" name="AppKey" placeholder="AppKey (32 hex)" value={form.AppKey} onChange={handleChange} required maxLength={32} />
            <button className="device-btn" type="submit" disabled={loading}>
              {loading ? <span className="device-spinner"></span> : "Registrar"}
            </button>
          </form>
          {regError && <div className="device-error">{regError}</div>}
          {regSuccess && <div className="device-success">{regSuccess}</div>}
        </div>
      </div>
      {/* Panel derecho: Buscar y vincular víctima */}
      <div className="device-management-right card">
        <h2 className="device-vincular-title">Buscar y Vincular Víctima</h2>
        <div className="device-vincular-form">
          <input type="text" placeholder="DNI de la víctima" value={dni} onChange={e => setDni(e.target.value)} />
          <button onClick={buscarVictima} className="device-btn" style={{ marginLeft: 8 }}>Buscar</button>
        </div>
        {victima && (
          <div className="device-victima-card">
            <h3>Datos de la víctima</h3>
            <div>Nombre: {victima.nombre} {victima.apellido}</div>
            <div>DNI: {victima.dni}</div>
            <div>Email: {victima.email}</div>
            <div>Rol: {victima.role}</div>
            <div>Orden Juez: {victima.ordenJuez ? "Sí" : "No"}</div>
            <div>Device vinculado: {victima.deviceId || "-"}</div>
            {/* Vincular dispositivo SOLO si NO está vinculado */}
            {!victima.deviceId && (
              <div style={{ marginTop: 12 }}>
                <label>
                  Selecciona dispositivo para vincular:&nbsp;
                  <select
                    value={deviceToLink || ""}
                    onChange={e => setDeviceToLink(e.target.value)}
                    style={{ padding: "0.5rem", borderRadius: 6 }}
                  >
                    <option value="">-- Selecciona --</option>
                    {devices
                      .filter(device => device.vinculado === "NO")
                      .map(device => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.deviceId}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="device-btn" style={{ marginLeft: 8 }} onClick={vincular}>Vincular</button>
              </div>
            )}
          </div>
        )}
        {error && <div className="device-error">{error}</div>}
        {success && <div className="device-success">{success}</div>}
      </div>
    </div>
  );
};

export default DeviceManagement;