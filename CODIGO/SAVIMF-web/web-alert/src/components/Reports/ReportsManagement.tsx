import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import './ReportsManagement.css';

interface Atestado {
  id: string;
  alertaId: string;
  patrulleroNombre: string;
  patrulleroUid: string;
  fechaIncidente: string;
  fechaCreacion: string;
  distrito: string;
  tipoViolencia: string;
  nivelRiesgo: string;
  alertaVeridica: boolean;
  nombreVictima: string;
  dniVictima: string;
  edadAproximada: number;
  requirioAmbulancia: boolean;
  requirioRefuerzo: boolean;
  victimaTrasladadaComisaria: boolean;
  accionesRealizadas?: string;
  observaciones?: string;
}

interface Alerta {
  id: string;
  timestamp: string;
  fechaCreacion: string;
  fechaTomada?: string;
  fechaEnCamino?: string;
  fechaResuelto?: string;
  estado: string;
  nivelUrgencia: string;
  cantidadActivaciones: number;
  esRecurrente: boolean;
  bateria?: number;
  patrulleroAsignado?: string;
  distrito?: string;
}

// 📊 INTERFACES PARA REPORTES
interface ReportePatrullero {
  uid: string;
  nombre: string;
  totalAsignaciones: number;
  alertasAtendidas: number;
  alertasVeridicas: number;
  tiempoPromedioRespuesta: number;
  tiempoPromedioResolucion: number;
  ambulanciasRequeridas: number;
  refuerzosRequeridos: number;
}

interface ReporteAlerta {
  mes: number;
  anio: number;
  totalAlertas: number;
  alertasVeridicas: number;
  alertasRecurrentes: number;
  urgenciaAlta: number;
  urgenciaMedia: number;
  urgenciaBaja: number;
  tiempoPromedioRespuesta: number;
}

interface ReporteZona {
  distrito: string;
  totalIncidentes: number;
  alertasVeridicas: number;
  tipoMasFrecuente: string;
  riesgoPredominante: string;
  urgenciaPromedio: number;
}

type TipoReporte = 'atestados' | 'patrulleros' | 'alertas' | 'zonas' | 'victimas';

const ReportsManagement: React.FC = () => {
  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipoReporte, setTipoReporte] = useState<TipoReporte>('atestados');
  const [filtroDistrito, setFiltroDistrito] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  const BASE_URL = 'http://18.225.31.96:5000';

  useEffect(() => {
    cargarAtestados();
    cargarAlertas();
  }, []);

  const cargarAlertas = async () => {
    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) return;

      const fin = new Date();
      const inicio = new Date();
      inicio.setMonth(inicio.getMonth() - 3); // Últimos 3 meses

      const response = await fetch(
        `${BASE_URL}/api/alerta/rango?fechaInicio=${inicio.toISOString()}&fechaFin=${fin.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAlertas(data.alertas || []);
      }
    } catch (err: any) {
      console.error('Error cargando alertas:', err);
    }
  };

  // 📊 GENERAR REPORTE DE PATRULLEROS
  const generarReportePatrulleros = (): ReportePatrullero[] => {
    const patrulleroMap = new Map<string, ReportePatrullero>();

    atestados.forEach(atestado => {
      const uid = atestado.patrulleroUid;
      if (!uid) return;

      if (!patrulleroMap.has(uid)) {
        patrulleroMap.set(uid, {
          uid,
          nombre: atestado.patrulleroNombre,
          totalAsignaciones: 0,
          alertasAtendidas: 0,
          alertasVeridicas: 0,
          tiempoPromedioRespuesta: 0,
          tiempoPromedioResolucion: 0,
          ambulanciasRequeridas: 0,
          refuerzosRequeridos: 0,
        });
      }

      const reporte = patrulleroMap.get(uid)!;
      reporte.totalAsignaciones++;
      reporte.alertasAtendidas++;
      if (atestado.alertaVeridica) reporte.alertasVeridicas++;
      if (atestado.requirioAmbulancia) reporte.ambulanciasRequeridas++;
      if (atestado.requirioRefuerzo) reporte.refuerzosRequeridos++;

      // Calcular tiempos desde alertas
      const alerta = alertas.find(a => a.id === atestado.alertaId);
      if (alerta?.fechaTomada && alerta?.fechaCreacion) {
        const respuesta = (new Date(alerta.fechaTomada).getTime() - new Date(alerta.fechaCreacion).getTime()) / 60000;
        reporte.tiempoPromedioRespuesta = (reporte.tiempoPromedioRespuesta * (reporte.totalAsignaciones - 1) + respuesta) / reporte.totalAsignaciones;
      }
      if (alerta?.fechaResuelto && alerta?.fechaCreacion) {
        const resolucion = (new Date(alerta.fechaResuelto).getTime() - new Date(alerta.fechaCreacion).getTime()) / 60000;
        reporte.tiempoPromedioResolucion = (reporte.tiempoPromedioResolucion * (reporte.totalAsignaciones - 1) + resolucion) / reporte.totalAsignaciones;
      }
    });

    return Array.from(patrulleroMap.values()).sort((a, b) => b.totalAsignaciones - a.totalAsignaciones);
  };

  // 📊 GENERAR REPORTE DE ALERTAS POR MES
  const generarReporteAlertas = (): ReporteAlerta[] => {
    const mesMap = new Map<string, ReporteAlerta>();

    alertas.forEach(alerta => {
      const fecha = new Date(alerta.fechaCreacion);
      const key = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
      
      if (!mesMap.has(key)) {
        mesMap.set(key, {
          mes: fecha.getMonth() + 1,
          anio: fecha.getFullYear(),
          totalAlertas: 0,
          alertasVeridicas: 0,
          alertasRecurrentes: 0,
          urgenciaAlta: 0,
          urgenciaMedia: 0,
          urgenciaBaja: 0,
          tiempoPromedioRespuesta: 0,
        });
      }

      const reporte = mesMap.get(key)!;
      reporte.totalAlertas++;
      
      // Buscar atestado correspondiente
      const atestado = atestados.find(a => a.alertaId === alerta.id);
      if (atestado?.alertaVeridica) reporte.alertasVeridicas++;
      if (alerta.esRecurrente) reporte.alertasRecurrentes++;
      
      switch(alerta.nivelUrgencia?.toLowerCase()) {
        case 'alta':
        case 'critica':
          reporte.urgenciaAlta++;
          break;
        case 'media':
          reporte.urgenciaMedia++;
          break;
        default:
          reporte.urgenciaBaja++;
      }

      if (alerta.fechaTomada && alerta.fechaCreacion) {
        const respuesta = (new Date(alerta.fechaTomada).getTime() - new Date(alerta.fechaCreacion).getTime()) / 60000;
        reporte.tiempoPromedioRespuesta = (reporte.tiempoPromedioRespuesta * (reporte.totalAlertas - 1) + respuesta) / reporte.totalAlertas;
      }
    });

    return Array.from(mesMap.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  };

  // 📊 GENERAR REPORTE DE ZONAS/DISTRITOS
  const generarReporteZonas = (): ReporteZona[] => {
    const zonaMap = new Map<string, ReporteZona>();

    atestados.forEach(atestado => {
      const distrito = atestado.distrito || 'Sin distrito';
      
      if (!zonaMap.has(distrito)) {
        zonaMap.set(distrito, {
          distrito,
          totalIncidentes: 0,
          alertasVeridicas: 0,
          tipoMasFrecuente: '',
          riesgoPredominante: '',
          urgenciaPromedio: 0,
        });
      }

      const reporte = zonaMap.get(distrito)!;
      reporte.totalIncidentes++;
      if (atestado.alertaVeridica) reporte.alertasVeridicas++;
    });

    // Calcular tipo más frecuente y riesgo predominante
    zonaMap.forEach((reporte, distrito) => {
      const atestadosDistrito = atestados.filter(a => (a.distrito || 'Sin distrito') === distrito);
      
      const tipoCount = new Map<string, number>();
      const riesgoCount = new Map<string, number>();
      let urgenciaTotal = 0;

      atestadosDistrito.forEach(a => {
        tipoCount.set(a.tipoViolencia, (tipoCount.get(a.tipoViolencia) || 0) + 1);
        riesgoCount.set(a.nivelRiesgo, (riesgoCount.get(a.nivelRiesgo) || 0) + 1);
        
        const alerta = alertas.find(al => al.id === a.alertaId);
        const urgenciaMap = { 'critica': 4, 'alta': 3, 'media': 2, 'baja': 1 };
        urgenciaTotal += urgenciaMap[alerta?.nivelUrgencia?.toLowerCase() as keyof typeof urgenciaMap] || 1;
      });

      reporte.tipoMasFrecuente = Array.from(tipoCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      reporte.riesgoPredominante = Array.from(riesgoCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      reporte.urgenciaPromedio = urgenciaTotal / atestadosDistrito.length;
    });

    return Array.from(zonaMap.values()).sort((a, b) => b.totalIncidentes - a.totalIncidentes);
  };

  const cargarAtestados = async () => {
    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      if (!token) {
        throw new Error('No autenticado');
      }

      const fin = new Date();
      const inicio = new Date();
      inicio.setMonth(inicio.getMonth() - 1);

      const response = await fetch(
        `${BASE_URL}/api/atestadopolicial/rango?fechaInicio=${inicio.toISOString()}&fechaFin=${fin.toISOString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAtestados(data.atestados || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error cargando atestados:', err);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorDistrito = async () => {
    if (!filtroDistrito.trim()) {
      cargarAtestados();
      return;
    }

    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(
        `${BASE_URL}/api/atestadopolicial/distrito/${filtroDistrito}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      if (!response.ok) throw new Error('Error al buscar por distrito');

      const data = await response.json();
      setAtestados(data.atestados || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const buscarPorFechas = async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Debes seleccionar fecha de inicio y fin');
      return;
    }

    try {
      setLoading(true);
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();

      const response = await fetch(
        `${BASE_URL}/api/atestadopolicial/rango?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      if (!response.ok) throw new Error('Error al buscar por fechas');

      const data = await response.json();
      setAtestados(data.atestados || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiesgoColor = (riesgo: string) => {
    switch (riesgo.toLowerCase()) {
      case 'critico': return 'badge-high';
      case 'alto': return 'badge-medium';
      case 'medio': return 'badge-low';
      case 'bajo': return 'badge-verified';
      default: return 'badge-pending';
    }
  };

  const getRiesgoEmoji = (riesgo: string) => {
    switch (riesgo.toLowerCase()) {
      case 'critico': return '🔴';
      case 'alto': return '🟠';
      case 'medio': return '🟡';
      case 'bajo': return '🟢';
      default: return '⚪';
    }
  };

  // 🎨 RENDER: REPORTE DE ATESTADOS (ORIGINAL)
  const renderReporteAtestados = () => (
    <>
      <div className="reports-filters">
        <h2>🔍 Filtros de Búsqueda</h2>
        <div className="filter-group">
          <div>
            <label>Distrito</label>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <input
                type="text"
                value={filtroDistrito}
                onChange={(e) => setFiltroDistrito(e.target.value)}
                placeholder="Ej: Centro"
                style={{flex: 1}}
              />
              <button onClick={buscarPorDistrito} className="btn-filter">
                Buscar
              </button>
            </div>
          </div>

          <div>
            <label>Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>

          <div>
            <label>Fecha Fin</label>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{flex: 1}}
              />
              <button onClick={buscarPorFechas} className="btn-filter">
                Buscar
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={cargarAtestados}
          className="btn-filter"
          style={{marginTop: '1rem', background: '#6b7280'}}
        >
          🔄 Recargar Todo
        </button>
      </div>

      <div className="reports-summary">
        <div className="summary-card">
          <div className="summary-value">{atestados.length}</div>
          <div className="summary-label">Total Atestados</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{color: '#10b981'}}>
            {atestados.filter(a => a.alertaVeridica).length}
          </div>
          <div className="summary-label">Alertas Verídicas</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{color: '#3b82f6'}}>
            {atestados.filter(a => a.requirioAmbulancia).length}
          </div>
          <div className="summary-label">Con Ambulancia</div>
        </div>
        <div className="summary-card">
          <div className="summary-value" style={{color: '#f97316'}}>
            {atestados.filter(a => a.requirioRefuerzo).length}
          </div>
          <div className="summary-label">Con Refuerzo</div>
        </div>
      </div>

      <div className="reports-table-container">
        <h2>📑 Listado de Atestados</h2>
        <table className="reports-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Distrito</th>
              <th>Víctima</th>
              <th>Tipo</th>
              <th>Riesgo</th>
              <th>Patrullero</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {atestados.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">
                  No hay atestados registrados
                </td>
              </tr>
            ) : (
              atestados.map((atestado) => (
                <tr key={atestado.id}>
                  <td>
                    {new Date(atestado.fechaIncidente).toLocaleDateString('es-PE', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td>{atestado.distrito}</td>
                  <td>
                    <div style={{fontWeight: 600}}>{atestado.nombreVictima}</div>
                    <div style={{fontSize: '0.875rem', color: '#64748b'}}>
                      DNI: {atestado.dniVictima}
                    </div>
                    <div style={{fontSize: '0.875rem', color: '#64748b'}}>
                      Edad: {atestado.edadAproximada}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{background: '#dbeafe', color: '#1e40af'}}>
                      {atestado.tipoViolencia}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getRiesgoColor(atestado.nivelRiesgo)}`}>
                      {getRiesgoEmoji(atestado.nivelRiesgo)} {atestado.nivelRiesgo}
                    </span>
                  </td>
                  <td>{atestado.patrulleroNombre}</td>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      {atestado.alertaVeridica ? (
                        <span className="badge badge-verified">✓ Verídica</span>
                      ) : (
                        <span className="badge badge-high">✗ Falsa</span>
                      )}
                      {atestado.requirioAmbulancia && (
                        <span title="Ambulancia">🚑</span>
                      )}
                      {atestado.requirioRefuerzo && (
                        <span title="Refuerzo">👮</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );

  // 🎨 RENDER: REPORTE DE PATRULLEROS
  const renderReportePatrulleros = () => {
    const reportePatrulleros = generarReportePatrulleros();

    return (
      <>
        <div className="reports-summary">
          <div className="summary-card">
            <div className="summary-value">{reportePatrulleros.length}</div>
            <div className="summary-label">Total Patrulleros Activos</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#3b82f6'}}>
              {reportePatrulleros.reduce((sum, p) => sum + p.totalAsignaciones, 0)}
            </div>
            <div className="summary-label">Total Asignaciones</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#10b981'}}>
              {reportePatrulleros.reduce((sum, p) => sum + p.alertasVeridicas, 0)}
            </div>
            <div className="summary-label">Alertas Verídicas</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#f97316'}}>
              {(reportePatrulleros.reduce((sum, p) => sum + p.tiempoPromedioRespuesta, 0) / reportePatrulleros.length || 0).toFixed(1)} min
            </div>
            <div className="summary-label">Tiempo Promedio Respuesta</div>
          </div>
        </div>

        <div className="reports-table-container">
          <h2>👮 Desempeño de Patrulleros</h2>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Patrullero</th>
                <th>Asignaciones</th>
                <th>Verídicas</th>
                <th>% Efectividad</th>
                <th>Tiempo Resp. Prom.</th>
                <th>Tiempo Resol. Prom.</th>
                <th>Ambulancias</th>
                <th>Refuerzos</th>
              </tr>
            </thead>
            <tbody>
              {reportePatrulleros.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-data">
                    No hay datos de patrulleros
                  </td>
                </tr>
              ) : (
                reportePatrulleros.map((patrullero) => (
                  <tr key={patrullero.uid}>
                    <td style={{fontWeight: 600}}>{patrullero.nombre}</td>
                    <td>{patrullero.totalAsignaciones}</td>
                    <td style={{color: '#10b981', fontWeight: 600}}>{patrullero.alertasVeridicas}</td>
                    <td>
                      <span className={`badge ${
                        (patrullero.alertasVeridicas / patrullero.totalAsignaciones) > 0.7 
                          ? 'badge-verified' 
                          : (patrullero.alertasVeridicas / patrullero.totalAsignaciones) > 0.5
                          ? 'badge-medium'
                          : 'badge-high'
                      }`}>
                        {((patrullero.alertasVeridicas / patrullero.totalAsignaciones) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>{patrullero.tiempoPromedioRespuesta.toFixed(1)} min</td>
                    <td>{patrullero.tiempoPromedioResolucion.toFixed(1)} min</td>
                    <td>{patrullero.ambulanciasRequeridas} 🚑</td>
                    <td>{patrullero.refuerzosRequeridos} 👮</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // 🎨 RENDER: REPORTE DE ALERTAS
  const renderReporteAlertas = () => {
    const reporteAlertas = generarReporteAlertas();

    return (
      <>
        <div className="reports-summary">
          <div className="summary-card">
            <div className="summary-value">{alertas.length}</div>
            <div className="summary-label">Total Alertas</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#f97316'}}>
              {alertas.filter(a => a.esRecurrente).length}
            </div>
            <div className="summary-label">Recurrentes 🔄</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#ef4444'}}>
              {alertas.filter(a => a.nivelUrgencia === 'alta' || a.nivelUrgencia === 'critica').length}
            </div>
            <div className="summary-label">Urgencia Alta/Crítica</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#3b82f6'}}>
              {alertas.filter(a => a.estado === 'resuelto').length}
            </div>
            <div className="summary-label">Resueltas</div>
          </div>
        </div>

        <div className="reports-table-container">
          <h2>🚨 Estadísticas de Alertas por Mes</h2>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Total</th>
                <th>Verídicas</th>
                <th>Recurrentes</th>
                <th>Urgencia Alta</th>
                <th>Urgencia Media</th>
                <th>Urgencia Baja</th>
                <th>Tiempo Resp. Prom.</th>
              </tr>
            </thead>
            <tbody>
              {reporteAlertas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="no-data">
                    No hay datos de alertas
                  </td>
                </tr>
              ) : (
                reporteAlertas.map((reporte, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight: 600}}>
                      {new Date(reporte.anio, reporte.mes - 1).toLocaleDateString('es-PE', {
                        year: 'numeric',
                        month: 'long'
                      })}
                    </td>
                    <td>{reporte.totalAlertas}</td>
                    <td style={{color: '#10b981', fontWeight: 600}}>{reporte.alertasVeridicas}</td>
                    <td>{reporte.alertasRecurrentes} 🔄</td>
                    <td style={{color: '#ef4444'}}>{reporte.urgenciaAlta}</td>
                    <td style={{color: '#f59e0b'}}>{reporte.urgenciaMedia}</td>
                    <td style={{color: '#10b981'}}>{reporte.urgenciaBaja}</td>
                    <td>{reporte.tiempoPromedioRespuesta.toFixed(1)} min</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // 🎨 RENDER: REPORTE DE ZONAS
  const renderReporteZonas = () => {
    const reporteZonas = generarReporteZonas();

    return (
      <>
        <div className="reports-summary">
          <div className="summary-card">
            <div className="summary-value">{reporteZonas.length}</div>
            <div className="summary-label">Total Distritos</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#3b82f6'}}>
              {reporteZonas.reduce((sum, z) => sum + z.totalIncidentes, 0)}
            </div>
            <div className="summary-label">Total Incidentes</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#ef4444'}}>
              {reporteZonas[0]?.distrito || 'N/A'}
            </div>
            <div className="summary-label">Zona Más Afectada</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#10b981'}}>
              {reporteZonas.reduce((sum, z) => sum + z.alertasVeridicas, 0)}
            </div>
            <div className="summary-label">Alertas Verídicas</div>
          </div>
        </div>

        <div className="reports-table-container">
          <h2>📍 Estadísticas por Distrito/Zona</h2>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Distrito</th>
                <th>Total Incidentes</th>
                <th>Verídicas</th>
                <th>% Efectividad</th>
                <th>Tipo Más Frecuente</th>
                <th>Riesgo Predominante</th>
                <th>Urgencia Promedio</th>
              </tr>
            </thead>
            <tbody>
              {reporteZonas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-data">
                    No hay datos de zonas
                  </td>
                </tr>
              ) : (
                reporteZonas.map((zona, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight: 600}}>{zona.distrito}</td>
                    <td>{zona.totalIncidentes}</td>
                    <td style={{color: '#10b981', fontWeight: 600}}>{zona.alertasVeridicas}</td>
                    <td>
                      <span className={`badge ${
                        (zona.alertasVeridicas / zona.totalIncidentes) > 0.7 
                          ? 'badge-verified' 
                          : (zona.alertasVeridicas / zona.totalIncidentes) > 0.5
                          ? 'badge-medium'
                          : 'badge-high'
                      }`}>
                        {((zona.alertasVeridicas / zona.totalIncidentes) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>{zona.tipoMasFrecuente}</td>
                    <td>
                      <span className={`badge ${getRiesgoColor(zona.riesgoPredominante)}`}>
                        {getRiesgoEmoji(zona.riesgoPredominante)} {zona.riesgoPredominante}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        zona.urgenciaPromedio >= 3 ? 'badge-high' :
                        zona.urgenciaPromedio >= 2 ? 'badge-medium' :
                        'badge-verified'
                      }`}>
                        {zona.urgenciaPromedio.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  // 🎨 RENDER: REPORTE DE VÍCTIMAS
  const renderReporteVictimas = () => {
    // Agrupar por rangos de edad
    const edadRangos = new Map<string, number>();
    const trasladosCount = atestados.filter(a => a.victimaTrasladadaComisaria).length;

    atestados.forEach(a => {
      let rango = 'Desconocido';
      if (a.edadAproximada < 18) rango = 'Menor de 18';
      else if (a.edadAproximada < 30) rango = '18-29';
      else if (a.edadAproximada < 40) rango = '30-39';
      else if (a.edadAproximada < 50) rango = '40-49';
      else if (a.edadAproximada < 60) rango = '50-59';
      else rango = '60+';

      edadRangos.set(rango, (edadRangos.get(rango) || 0) + 1);
    });

    return (
      <>
        <div className="reports-summary">
          <div className="summary-card">
            <div className="summary-value">{atestados.length}</div>
            <div className="summary-label">Total Víctimas Atendidas</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#3b82f6'}}>
              {trasladosCount}
            </div>
            <div className="summary-label">Traslados a Comisaría</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#10b981'}}>
              {(atestados.reduce((sum, a) => sum + a.edadAproximada, 0) / atestados.length || 0).toFixed(1)}
            </div>
            <div className="summary-label">Edad Promedio</div>
          </div>
          <div className="summary-card">
            <div className="summary-value" style={{color: '#f97316'}}>
              {Array.from(edadRangos.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </div>
            <div className="summary-label">Rango de Edad Predominante</div>
          </div>
        </div>

        <div className="reports-table-container">
          <h2>👤 Estadísticas de Víctimas por Rango de Edad</h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
            {Array.from(edadRangos.entries()).sort((a, b) => b[1] - a[1]).map(([rango, cantidad]) => (
              <div key={rango} className="summary-card">
                <div className="summary-label">{rango} años</div>
                <div className="summary-value" style={{fontSize: '2rem'}}>{cantidad}</div>
                <div style={{fontSize: '0.875rem', color: '#64748b'}}>
                  {((cantidad / atestados.length) * 100).toFixed(1)}% del total
                </div>
              </div>
            ))}
          </div>

          <h2>📊 Distribución por Tipo de Violencia</h2>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Tipo de Violencia</th>
                <th>Cantidad</th>
                <th>% del Total</th>
                <th>Con Ambulancia</th>
                <th>Con Traslado</th>
              </tr>
            </thead>
            <tbody>
              {['fisica', 'psicologica', 'sexual', 'economica'].map(tipo => {
                const cantidad = atestados.filter(a => a.tipoViolencia.toLowerCase() === tipo).length;
                const conAmbulancia = atestados.filter(a => a.tipoViolencia.toLowerCase() === tipo && a.requirioAmbulancia).length;
                const conTraslado = atestados.filter(a => a.tipoViolencia.toLowerCase() === tipo && a.victimaTrasladadaComisaria).length;

                return cantidad > 0 ? (
                  <tr key={tipo}>
                    <td style={{fontWeight: 600, textTransform: 'capitalize'}}>{tipo}</td>
                    <td>{cantidad}</td>
                    <td>
                      <span className="badge badge-medium">
                        {((cantidad / atestados.length) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td>{conAmbulancia} 🚑</td>
                    <td>{conTraslado} 🏛️</td>
                  </tr>
                ) : null;
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  if (loading) {
    return (
      <div className="reports-container">
        <div className="loading">Cargando reportes...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="reports-container">
        <div className="loading">Cargando reportes...</div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>📋 Reportes del Sistema</h1>
        <p>Análisis y estadísticas de atestados, patrulleros, alertas y zonas - Información confidencial</p>
      </div>

      {/* TABS DE TIPOS DE REPORTES */}
      <div className="reports-tabs">
        <button
          className={`tab-button ${tipoReporte === 'atestados' ? 'active' : ''}`}
          onClick={() => setTipoReporte('atestados')}
        >
          📋 Atestados
        </button>
        <button
          className={`tab-button ${tipoReporte === 'patrulleros' ? 'active' : ''}`}
          onClick={() => setTipoReporte('patrulleros')}
        >
          👮 Patrulleros
        </button>
        <button
          className={`tab-button ${tipoReporte === 'alertas' ? 'active' : ''}`}
          onClick={() => setTipoReporte('alertas')}
        >
          🚨 Alertas
        </button>
        <button
          className={`tab-button ${tipoReporte === 'zonas' ? 'active' : ''}`}
          onClick={() => setTipoReporte('zonas')}
        >
          📍 Zonas
        </button>
        <button
          className={`tab-button ${tipoReporte === 'victimas' ? 'active' : ''}`}
          onClick={() => setTipoReporte('victimas')}
        >
          👤 Víctimas
        </button>
      </div>

      {error && (
        <div className="error">
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando reportes...</div>
      ) : (
        <>
          {tipoReporte === 'atestados' && renderReporteAtestados()}
          {tipoReporte === 'patrulleros' && renderReportePatrulleros()}
          {tipoReporte === 'alertas' && renderReporteAlertas()}
          {tipoReporte === 'zonas' && renderReporteZonas()}
          {tipoReporte === 'victimas' && renderReporteVictimas()}
        </>
      )}
    </div>
  );
};

export default ReportsManagement;
