import React, { useState, useEffect } from 'react';
import './OpenDataModule.css';

interface OpenDataIncidente {
  id: string;
  // ⏰ Ciclo de vida de la alerta
  fechaCreacionAlerta?: string;
  fechaTomadaAlerta?: string;
  fechaEnCamino?: string;
  fechaResuelto?: string;
  
  // ⏱️ Tiempos calculados (en minutos)
  tiempoRespuestaMinutos?: number;
  tiempoEnCaminoMinutos?: number;
  tiempoResolucionMinutos?: number;
  tiempoTotalMinutos?: number;
  
  // 📅 Temporal
  fechaIncidente: string;
  anio: number;
  mes: number;
  dia: number;
  diaSemana: string;
  horaDelDia: number;
  minutoDelDia: number;
  
  // 📊 Metadata de la alerta
  cantidadActivaciones: number;
  esRecurrente: boolean;
  estadoFinal: string;
  nivelUrgencia: string;
  
  // 📍 Ubicación anonimizada
  latitudRedondeada: number;
  longitudRedondeada: number;
  distrito: string;
  
  // 🔍 Características
  tipoViolencia: string;
  nivelRiesgo: string;
  alertaVeridica: boolean;
  
  // 👤 Demografía anonimizada
  edadVictimaRango: string;
  generoVictima: string;
  
  // 🚨 Recursos
  requirioAmbulancia: boolean;
  requirioRefuerzo: boolean;
  victimaTrasladadaComisaria: boolean;
  
  // 🔋 Dispositivo (anonimizado)
  bateriaNivel?: number;
  dispositivoTipo: string;
}

interface OpenDataAgregado {
  id: string;
  distrito: string;
  anio: number;
  mes: number;
  totalIncidentes: number;
  totalVeridicos: number;
  totalFalsos: number;
  totalCriticos: number;
  totalAltos: number;
  totalMedios: number;
  totalBajos: number;
  totalFisica: number;
  totalPsicologica: number;
  totalSexual: number;
  totalEconomica: number;
  promedioEdad: number;
  tipoMasFrecuente: string;
  riesgoPredominante: string;
}

interface DashboardData {
  totalIncidentes: number;
  totalVeridicos: number;
  porcentajeVeridicos: number;
  tipoMasFrecuente: string;
  riesgoPredominante: string;
  distritoMasAfectado: string;
  
  // 🆕 MÉTRICAS DE TIEMPOS
  tiempoPromedioRespuesta: number; // minutos
  tiempoPromedioResolucion: number; // minutos
  alertasRecurrentes: number;
  alertasUrgenciaAlta: number;
  
  tendencia?: string;
  ultimaActualizacion?: string;
  porDistrito: { [distrito: string]: number };
  porTipo: { [tipo: string]: number };
  porRiesgo: { [riesgo: string]: number };
}

const OpenDataModule: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [incidentes, setIncidentes] = useState<OpenDataIncidente[]>([]);
  const [agregados, setAgregados] = useState<OpenDataAgregado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vistaActual, setVistaActual] = useState<'dashboard' | 'incidentes' | 'estadisticas'>('dashboard');
  const [filtroDistrito, setFiltroDistrito] = useState<string>('');
  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [filtroMes, setFiltroMes] = useState<number | null>(null); // null = todos los meses

  // 🔥 URL del backend
  const BASE_URL = 'http://18.225.31.96:5000';

  useEffect(() => {
    // Cargar datos iniciales cuando se monta el componente.
    // Nota: ya no modificamos el <body> para esconder el sidebar; el fix definitivo evita render duplicado.
    cargarDashboard();
    // no hay limpieza especial necesaria aquí
  }, []);

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/opendata/dashboard`, {
        headers: {
          'ngrok-skip-browser-warning': 'true' // Skip ngrok warning page
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar dashboard');
      }

      const data = await response.json();
      setDashboard(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/opendata/estadisticas/anio/${filtroAnio}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Error al cargar estadísticas');
      const data = await response.json();
      setAgregados(data.agregados || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const descargarCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append('anio', filtroAnio.toString());
      if (filtroMes !== null) params.append('mes', filtroMes.toString());

      const response = await fetch(`${BASE_URL}/api/opendata/descargar/csv?${params.toString()}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (!response.ok) throw new Error('Error al descargar CSV');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opendata_incidentes_${filtroAnio}${filtroMes ? `_${filtroMes.toString().padStart(2,'0')}` : ''}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al descargar CSV: ' + err.message);
    }
  };

  const cargarIncidentes = async () => {
    try {
      setLoading(true);
      const url = filtroDistrito
        ? `${BASE_URL}/api/opendata/incidentes/distrito/${filtroDistrito}`
        : `${BASE_URL}/api/opendata/incidentes`;

      const response = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error('Error al cargar incidentes');
      }

      const data = await response.json();
      setIncidentes(data.incidentes || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const descargarJSON = async () => {
    try {
      // Construir URL con parámetros
      const params = new URLSearchParams();
      params.append('anio', filtroAnio.toString());
      if (filtroMes !== null) {
        params.append('mes', filtroMes.toString());
      }
      
      const response = await fetch(`${BASE_URL}/api/opendata/descargar/json?${params.toString()}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al descargar JSON');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opendata_incidentes_${filtroAnio}${filtroMes ? `_${filtroMes.toString().padStart(2, '0')}` : ''}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Error al descargar JSON: ' + err.message);
    }
  };

  const getRiesgoColor = (riesgo: string) => {
    switch (riesgo.toLowerCase()) {
      case 'critico': return 'riesgo-critico';
      case 'alto': return 'riesgo-alto';
      case 'medio': return 'riesgo-medio';
      case 'bajo': return 'riesgo-bajo';
      default: return 'riesgo-default';
    }
  };

  const getRiesgoBgColor = (riesgo: string) => {
    switch (riesgo.toLowerCase()) {
      case 'critico': return '#ef4444';
      case 'alto': return '#f97316';
      case 'medio': return '#f59e0b';
      case 'bajo': return '#10b981';
      default: return '#9ca3af';
    }
  };

  const renderDashboard = () => {
    if (!dashboard) return null;

    return (
      <div>
        {/* Estadísticas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Incidentes</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{dashboard.totalIncidentes}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Alertas Verídicas</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{dashboard.totalVeridicos}</p>
                <p className="text-xs text-gray-500 mt-1">{dashboard.porcentajeVeridicos.toFixed(1)}%</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tipo Frecuente</p>
                <p className="text-xl font-bold text-blue-600 mt-2">{dashboard.tipoMasFrecuente}</p>
              </div>
              <div className="text-4xl">⚠️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Riesgo Dominante</p>
                <p className="text-xl font-bold text-orange-600 mt-2">{dashboard.riesgoPredominante}</p>
              </div>
              <div className="text-4xl">🔴</div>
            </div>
          </div>
        </div>

        {/* 🆕 NUEVAS MÉTRICAS DE TIEMPOS Y ACTIVIDAD */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Tiempo Promedio Respuesta</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">{dashboard.tiempoPromedioRespuesta.toFixed(1)} min</p>
                <p className="text-xs text-blue-600 mt-1">⏱️ Desde alerta hasta asignación</p>
              </div>
              <div className="text-4xl">🚨</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Tiempo Promedio Resolución</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">{dashboard.tiempoPromedioResolucion.toFixed(1)} min</p>
                <p className="text-xs text-purple-600 mt-1">⏱️ Desde alerta hasta cierre</p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Alertas Recurrentes</p>
                <p className="text-3xl font-bold text-orange-900 mt-2">{dashboard.alertasRecurrentes}</p>
                <p className="text-xs text-orange-600 mt-1">🔄 Múltiples activaciones</p>
              </div>
              <div className="text-4xl">🔁</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Urgencia Alta/Crítica</p>
                <p className="text-3xl font-bold text-red-900 mt-2">{dashboard.alertasUrgenciaAlta}</p>
                <p className="text-xs text-red-600 mt-1">⚠️ Prioridad máxima</p>
              </div>
              <div className="text-4xl">🆘</div>
            </div>
          </div>
        </div>

        {/* Distribución por Distrito */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">📍 Distribución por Distrito</h3>
          <div className="space-y-3">
            {Object.entries(dashboard.porDistrito).map(([distrito, cantidad]) => (
              <div key={distrito}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{distrito}</span>
                  <span className="text-gray-600">{cantidad} incidentes</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(cantidad / dashboard.totalIncidentes) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Por Tipo de Violencia */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">🔸 Por Tipo de Violencia</h3>
            <div className="space-y-3">
              {Object.entries(dashboard.porTipo).map(([tipo, cantidad]) => (
                <div key={tipo} className="flex items-center">
                  <div className="w-32 text-sm font-medium text-gray-700">{tipo}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className="h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(cantidad / dashboard.totalIncidentes) * 100}%`, background: '#7c3aed' }}
                      >
                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{cantidad}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Por Nivel de Riesgo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">⚡ Por Nivel de Riesgo</h3>
            <div className="space-y-3">
              {Object.entries(dashboard.porRiesgo).map(([riesgo, cantidad]) => (
                <div key={riesgo} className="flex items-center">
                  <div className="w-32 text-sm font-medium text-gray-700">{riesgo}</div>
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className="h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(cantidad / dashboard.totalIncidentes) * 100}%`, background: getRiesgoBgColor(riesgo) }}
                      >
                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{cantidad}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Información Adicional */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Distrito más afectado:</strong> {dashboard.distritoMasAfectado}
                {dashboard.tendencia && <> | <strong> Tendencia:</strong> {dashboard.tendencia}</>}
                {dashboard.ultimaActualizacion && <> | <strong> Última actualización:</strong> {new Date(dashboard.ultimaActualizacion).toLocaleString('es-PE')}</>}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderIncidentes = () => {
    return (
      <div>
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">🔍 Filtros</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={filtroDistrito}
              onChange={(e) => setFiltroDistrito(e.target.value)}
              placeholder="Filtrar por distrito..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={cargarIncidentes}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Tabla de Incidentes */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distrito</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Riesgo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgencia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activaciones</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiempo Resp.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batería</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recursos</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incidentes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      No hay incidentes. Haz clic en "Buscar" para cargar datos.
                    </td>
                  </tr>
                ) : (
                  incidentes.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(inc.fechaIncidente).toLocaleString('es-PE')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inc.distrito}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {inc.tipoViolencia}
                        </span>
                      </td>
                      <td>
                        <span className={getRiesgoColor(inc.nivelRiesgo)}>
                          {inc.nivelRiesgo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          inc.nivelUrgencia === 'alta' || inc.nivelUrgencia === 'critica' 
                            ? 'bg-red-100 text-red-800' 
                            : inc.nivelUrgencia === 'media'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {inc.nivelUrgencia}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          inc.esRecurrente ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {inc.cantidadActivaciones} {inc.esRecurrente && '🔄'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {inc.tiempoRespuestaMinutos ? `${inc.tiempoRespuestaMinutos.toFixed(1)} min` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {inc.bateriaNivel ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${
                            inc.bateriaNivel > 50 ? 'bg-green-100 text-green-800' :
                            inc.bateriaNivel > 20 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            🔋 {inc.bateriaNivel}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {inc.requirioAmbulancia && <span className="mr-2" title="Ambulancia">🚑</span>}
                        {inc.requirioRefuerzo && <span className="mr-2" title="Refuerzo">👮</span>}
                        {inc.victimaTrasladadaComisaria && <span title="Traslado">🏛️</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEstadisticas = () => {
    return (
      <div>
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">📅 Filtros</h3>
          <div className="flex gap-4">
            <input
              type="number"
              value={filtroAnio}
              onChange={(e) => setFiltroAnio(parseInt(e.target.value))}
              placeholder="Año"
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={cargarEstadisticas}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Buscar
            </button>
          </div>
        </div>

        {/* Tabla de Estadísticas */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Distrito</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verídicos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo Frecuente</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Riesgo</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {agregados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No hay estadísticas. Haz clic en "Buscar" para cargar datos.
                    </td>
                  </tr>
                ) : (
                  agregados.map((agg) => (
                    <tr key={agg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{agg.distrito}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agg.mes}/{agg.anio}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agg.totalIncidentes}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{agg.totalVeridicos}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agg.tipoMasFrecuente}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{agg.riesgoPredominante}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="opendata-container">
      <div>
        {/* Header */}
        <div className="opendata-header">
          <h1>Open Data - Datos Abiertos</h1>
          <p>Información pública y anonimizada sobre incidentes de violencia contra la mujer en Tacna</p>
        </div>

        {/* Botones de Descarga */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Descargar Datos</h3>
          
          {/* Filtros de descarga */}
          <div className="mb-4 flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={filtroAnio}
                onChange={(e) => setFiltroAnio(parseInt(e.target.value))}
                min="2020"
                max="2030"
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mes (opcional)</label>
              <select
                value={filtroMes ?? ''}
                onChange={(e) => setFiltroMes(e.target.value ? parseInt(e.target.value) : null)}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todos los meses</option>
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              {filtroMes 
                ? `Descargar datos de ${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][filtroMes-1]} ${filtroAnio}`
                : `Descargar todos los datos de ${filtroAnio}`
              }
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={descargarCSV}
              className="btn-download btn-csv"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar CSV
            </button>
            <button
              onClick={descargarJSON}
              className="btn-download btn-json"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar JSON
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Los datos están anonimizados. No contienen información personal identificable (nombres, DNI). Las coordenadas están redondeadas a 3 decimales (~111m de precisión).
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex">
              <button
                onClick={() => { setVistaActual('dashboard'); cargarDashboard(); }}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  vistaActual === 'dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setVistaActual('incidentes')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  vistaActual === 'incidentes'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
               Incidentes
              </button>
              <button
                onClick={() => setVistaActual('estadisticas')}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  vistaActual === 'estadisticas'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                 Estadísticas
              </button>
            </nav>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Contenido según vista */}
        {vistaActual === 'dashboard' && renderDashboard()}
        {vistaActual === 'incidentes' && renderIncidentes()}
        {vistaActual === 'estadisticas' && renderEstadisticas()}
      </div>
    </div>
  );
};

export default OpenDataModule;
