import React, { useState, useEffect } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import api from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config/googleMaps';

interface HeatmapPoint {
  lat: number;
  lng: number;
  intensidad: number;
  alertas: Array<{
    id: string;
    fecha: string;
    tipo: string;
    nombre: string;
  }>;
}

interface AnalysisData {
  fechaInicio: string;
  fechaFin: string;
  totalAlertas: number;
  puntosCalor: HeatmapPoint[];
  estadisticas: {
    zonasMasActivas: HeatmapPoint[];
    promedioAlertasPorDia: number;
    tiposSeveridad: Array<{ tipo: string; cantidad: number }>;
  };
}

interface TooltipInfo {
  position: { x: number; y: number };
  zona: HeatmapPoint | null;
}

const HeatmapAnalysis: React.FC = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedMonth, setSelectedMonth] = useState(11); // Noviembre
  const [mapCenter] = useState({ lat: -18.047439, lng: -70.2633 }); // Tacna, Perú
  const [selectedZone, setSelectedZone] = useState<HeatmapPoint | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo>({ position: { x: 0, y: 0 }, zona: null });
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [overlay, setOverlay] = useState<GoogleMapsOverlay | null>(null);

  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // 📊 CARGAR DATOS DEL MAPA DE CALOR
  const loadHeatmapData = async () => {
    setLoading(true);
    try {
      const fechaInicio = new Date(selectedYear, selectedMonth, 1).toISOString();
      const fechaFin = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

      const response = await api.get<AnalysisData>(`/analisis/mapa-calor`, {
        params: { fechaInicio, fechaFin }
      });

      setAnalysisData(response.data);
      console.log('📊 Datos de calor cargados:', response.data);
    } catch (error) {
      console.error('❌ Error cargando mapa de calor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeatmapData();
  }, [selectedYear, selectedMonth]);

  // 🎨 Configurar deck.gl HeatmapLayer cuando hay datos
  useEffect(() => {
    if (!map || !analysisData || !analysisData.puntosCalor.length) return;

    // Crear overlay de deck.gl sobre Google Maps
    const deckOverlay = new GoogleMapsOverlay({
      layers: [
        new HeatmapLayer({
          id: 'heatmap',
          data: analysisData.puntosCalor,
          getPosition: (d: HeatmapPoint) => [d.lng, d.lat], // ⚠️ deck.gl usa [lng, lat]
          getWeight: (d: HeatmapPoint) => d.intensidad,
          radiusPixels: 50, // Radio del efecto de calor
          intensity: 2, // Multiplicador de intensidad
          threshold: 0.03, // Umbral para suavizado de bordes
          colorRange: [
            [0, 0, 255, 25],      // Azul muy transparente
            [0, 0, 255, 255],     // Azul
            [0, 255, 255, 255],   // Cyan
            [0, 255, 0, 255],     // Verde
            [255, 255, 0, 255],   // Amarillo
            [255, 165, 0, 255],   // Naranja
            [255, 0, 0, 255]      // Rojo intenso
          ],
          aggregation: 'SUM' as const // Sumar pesos en áreas superpuestas
        })
      ]
    });

    deckOverlay.setMap(map);
    setOverlay(deckOverlay);

    // Cleanup al desmontar
    return () => {
      deckOverlay.setMap(null);
    };
  }, [map, analysisData]);

  // 🖱️ MANEJO DE EVENTOS DE MOUSE para tooltip interactivo
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!analysisData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convertir coordenadas del mouse a lat/lng
    const bounds = {
      northEast: { lat: -18.0047, lng: -70.2500 },
      southWest: { lat: -18.0500, lng: -70.2653 }
    };

    const lat = bounds.southWest.lat + (1 - y / rect.height) * (bounds.northEast.lat - bounds.southWest.lat);
    const lng = bounds.southWest.lng + (x / rect.width) * (bounds.northEast.lng - bounds.southWest.lng);

    // Buscar el punto más cercano
    const THRESHOLD = 0.005; // ~500 metros
    const closestZone = analysisData.puntosCalor.find(punto => {
      const distance = Math.sqrt(
        Math.pow(punto.lat - lat, 2) + Math.pow(punto.lng - lng, 2)
      );
      return distance < THRESHOLD;
    });

    if (closestZone) {
      setTooltip({
        position: { x: e.clientX, y: e.clientY },
        zona: closestZone
      });
    } else {
      setTooltip({ position: { x: 0, y: 0 }, zona: null });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ position: { x: 0, y: 0 }, zona: null });
  };

  // 🎨 OBTENER COLOR SEGÚN INTENSIDAD
  const getIntensityColor = (intensidad: number, max: number) => {
    const ratio = intensidad / max;
    if (ratio < 0.2) return '#3b82f6'; // Azul
    if (ratio < 0.4) return '#06b6d4'; // Cyan
    if (ratio < 0.6) return '#10b981'; // Verde
    if (ratio < 0.8) return '#fbbf24'; // Amarillo
    return '#ef4444'; // Rojo
  };

  // 📍 OBTENER NOMBRE DE ZONA basado en coordenadas de Tacna
  const getZoneName = (lat: number, lng: number) => {
    // Zonas actualizadas de Tacna con coordenadas más precisas
    const zones = [
      { name: 'Centro de Tacna', lat: -18.0047, lng: -70.2500, radius: 0.008 },
      { name: 'Alto de la Alianza', lat: -18.0155, lng: -70.2445, radius: 0.012 },
      { name: 'Ciudad Nueva', lat: -18.0280, lng: -70.2450, radius: 0.012 },
      { name: 'Gregorio Albarracín Lanchipa', lat: -18.0500, lng: -70.2400, radius: 0.018 },
      { name: 'Pocollay', lat: -17.9947, lng: -70.2304, radius: 0.010 },
      { name: 'Calana', lat: -17.9500, lng: -70.1800, radius: 0.012 },
      { name: 'Pachia', lat: -17.8950, lng: -70.1600, radius: 0.015 },
      { name: 'Palca', lat: -17.8800, lng: -70.0500, radius: 0.015 },
      { name: 'Sama', lat: -17.9900, lng: -70.4500, radius: 0.020 },
      { name: 'Inclán', lat: -17.7900, lng: -70.3500, radius: 0.015 },
      { name: 'Para', lat: -18.1000, lng: -70.0800, radius: 0.015 },
      { name: 'Coronel Gregorio Albarracín', lat: -18.0600, lng: -70.2300, radius: 0.015 }
    ];

    // Encontrar la zona más cercana
    let closestZone = zones[0];
    let minDistance = Infinity;

    zones.forEach(zone => {
      const distance = Math.sqrt(
        Math.pow(zone.lat - lat, 2) + Math.pow(zone.lng - lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestZone = zone;
      }
    });

    // Si está dentro del radio de la zona más cercana, devolver el nombre
    if (minDistance < closestZone.radius) {
      return closestZone.name;
    }

    // Si no está cerca de ninguna zona conocida, mostrar coordenadas
    return `Zona (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

  return (
    <div style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 🎛️ CONTROLES TEMPORALES */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ margin: '0 0 20px 0', color: '#1f2937' }}>
          📊 Análisis de Patrones de Emergencias
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Selector de Año */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Año:</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                fontSize: '14px'
              }}
            >
              <option value={2023}>2023</option>
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
            </select>
          </div>

          {/* Selector de Mes */}
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Mes:</label>
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '5px',
                fontSize: '14px'
              }}
            >
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          {/* Botón de Actualizar */}
          <button
            onClick={loadHeatmapData}
            disabled={loading}
            style={{
              padding: '10px 20px',
              backgroundColor: loading ? '#6b7280' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>

        {/* 📈 ESTADÍSTICAS RÁPIDAS */}
        {analysisData && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px',
            marginTop: '20px'
          }}>
            <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                {analysisData.totalAlertas}
              </div>
              <div style={{ color: '#6b7280' }}>Total de Alertas</div>
            </div>
            
            <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                {analysisData.estadisticas.promedioAlertasPorDia.toFixed(1)}
              </div>
              <div style={{ color: '#6b7280' }}>Promedio por Día</div>
            </div>
            
            <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>
                {analysisData.puntosCalor.length}
              </div>
              <div style={{ color: '#6b7280' }}>Zonas Afectadas</div>
            </div>
          </div>
        )}
      </div>

      {/* MAPA DE CALOR */}
      <div style={{ flex: 1, display: 'flex', gap: '20px' }}>
        {/* Mapa principal */}
        <div style={{ 
          flex: selectedZone ? '0 0 70%' : '1', 
          background: 'white', 
          borderRadius: '10px', 
          overflow: 'hidden', 
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)', 
          position: 'relative',
          transition: 'all 0.3s ease'
        }}>
          {/* Tooltip flotante */}
          {tooltip.zona && (
            <div
              style={{
                position: 'fixed',
                left: tooltip.position.x + 15,
                top: tooltip.position.y + 15,
                background: 'rgba(0, 0, 0, 0.9)',
                color: 'white',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                zIndex: 1000,
                pointerEvents: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                maxWidth: '250px'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}>
                {getZoneName(tooltip.zona.lat, tooltip.zona.lng)}
              </div>
              <div style={{ marginBottom: '4px' }}>
                🔥 Intensidad: <strong>{tooltip.zona.intensidad}</strong> alertas
              </div>
              <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                Click para ver detalles
              </div>
            </div>
          )}

          {/* Leyenda del mapa de calor */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 100,
            fontSize: '12px'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#1f2937' }}>
              Intensidad de Alertas
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(0, 0, 255, 1)', borderRadius: '2px' }}></div>
                <span>Muy Baja</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(0, 255, 255, 1)', borderRadius: '2px' }}></div>
                <span>Baja</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(0, 255, 0, 1)', borderRadius: '2px' }}></div>
                <span>Media</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(255, 255, 0, 1)', borderRadius: '2px' }}></div>
                <span>Alta</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(255, 165, 0, 1)', borderRadius: '2px' }}></div>
                <span>Muy Alta</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '20px', height: '12px', background: 'rgba(255, 0, 0, 1)', borderRadius: '2px' }}></div>
                <span>Crítica</span>
              </div>
            </div>
          </div>
          
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={13}
            onLoad={(mapInstance) => setMap(mapInstance)}
            options={{
              mapTypeId: 'roadmap',
              styles: [
                  {
                    featureType: 'all',
                    elementType: 'geometry',
                    stylers: [{ saturation: -20 }]
                  }
                ]
              }}
            >
              {/* deck.gl HeatmapLayer se renderiza automáticamente vía overlay */}

              {/* 🎯 Marcadores INVISIBLES clickeables sobre las zonas de calor */}
              {analysisData?.estadisticas.zonasMasActivas.slice(0, 10).map((zona, index) => {
                const zoneKey = `${zona.lat}-${zona.lng}`;
                
                return (
                  <Marker
                    key={index}
                    position={{ lat: zona.lat, lng: zona.lng }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: 'transparent',
                      fillOpacity: 0,
                      strokeColor: 'transparent',
                      strokeWeight: 0
                    }}
                    onClick={() => setSelectedZone(zona)}
                    onMouseOver={() => setHoveredMarker(zoneKey)}
                    onMouseOut={() => setHoveredMarker(null)}
                    cursor="pointer"
                  >
                    {hoveredMarker === zoneKey && (
                      <InfoWindow
                        position={{ lat: zona.lat, lng: zona.lng }}
                        options={{ pixelOffset: new google.maps.Size(0, -10) }}
                      >
                        <div style={{ padding: '10px', minWidth: '180px' }}>
                          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', color: '#1f2937' }}>
                            {getZoneName(zona.lat, zona.lng)}
                          </h3>
                          <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#4b5563' }}>
                            🔥 <strong>{zona.intensidad}</strong> alertas registradas
                          </p>
                          <p style={{ margin: '0', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                            Click para ver detalles completos
                          </p>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                );
              })}
            </GoogleMap>
        </div>

        {/* Panel lateral de detalles - aparece al hacer click */}
        {selectedZone && (
          <div style={{
            flex: '0 0 28%',
            background: 'white',
            borderRadius: '10px',
            padding: '20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            maxHeight: '100%',
            animation: 'slideIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#1f2937' }}>📍 Detalles de Zona</h3>
              <button
                onClick={() => setSelectedZone(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', background: '#f3f4f6', borderRadius: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                {getZoneName(selectedZone.lat, selectedZone.lng)}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                📌 Lat: {selectedZone.lat.toFixed(4)}, Lng: {selectedZone.lng.toFixed(4)}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                🔥 Intensidad: <strong>{selectedZone.intensidad}</strong> alertas
              </div>
            </div>

            <h4 style={{ marginBottom: '12px', color: '#1f2937', fontSize: '14px' }}>
              🚨 Alertas Registradas ({selectedZone.alertas.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedZone.alertas.map((alerta, index) => (
                <div
                  key={alerta.id}
                  style={{
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    borderLeft: '3px solid #3b82f6',
                    fontSize: '13px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1f2937' }}>
                    {index + 1}. {alerta.nombre || alerta.tipo}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>
                    📅 {new Date(alerta.fecha).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '12px' }}>
                    <span style={{
                      background: alerta.tipo === 'Crítica' ? '#fee2e2' : 
                                 alerta.tipo === 'Alta' ? '#fef3c7' : '#dbeafe',
                      color: alerta.tipo === 'Crítica' ? '#991b1b' :
                             alerta.tipo === 'Alta' ? '#92400e' : '#1e40af',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                      {alerta.tipo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HeatmapAnalysis;