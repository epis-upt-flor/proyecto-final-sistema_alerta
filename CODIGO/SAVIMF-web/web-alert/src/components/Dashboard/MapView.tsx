import React, { useEffect, useState, useRef } from "react";
import { Alert } from "../../types/alert";
import { PatrullaUbicacion } from "../../types/patrulla";
import { GoogleMap, Marker, InfoWindow, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY as SHARED_GOOGLE_MAPS_API_KEY, MAP_LIBRARIES } from "../../config/googleMaps";
import * as signalR from "@microsoft/signalr";
import api from "../../services/api";
import { getAddressFromCoords } from "../../services/geocoding";

const GOOGLE_MAPS_API_KEY = "AIzaSyD_4MSV8UftvnM5JetkCZxHJTZRPkrtlpQ";
const SIGNALR_URL = "http://18.225.31.96:5000/alertaHub";

// 🔧 Declaraciones de tipos para Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}

// 🆕 Configuración del sistema híbrido de rutas (igual que Flutter)
const ROUTE_DEVIATION_THRESHOLD = 50.0; // metros - cuándo pedir nueva ruta
const MAX_REQUERY_INTERVAL_SECONDS = 120; // 2 minutos máximo sin actualizar
const ROUTE_UPDATE_INTERVAL_SECONDS = 8; // cada cuánto revisar si actualizar
const MIN_MOVEMENT_THRESHOLD = 10.0; // metros mínimos para considerar movimiento

// 🆕 Interfaces para sistema de rutas
interface RoutePoint {
  lat: number;
  lng: number;
}

interface ActiveRoute {
  alertId: string;
  patrullaId: string;
  points: RoutePoint[];
  originalCompleteRoute: RoutePoint[];
  lastOriginLat: number;
  lastOriginLng: number;
  lastDirectionsRequest: Date | null;
  isRequestingNewRoute: boolean;
}

const containerStyle = { width: "100%", height: "100vh" };
const defaultCenter = { lat: -18.0066, lng: -70.2463 };

const MapView = () => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    // use the shared stable MAP_LIBRARIES array to avoid re-creating a new array every render
    libraries: MAP_LIBRARIES as any
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(13);

  // Estados existentes
  const [alertas, setAlertas] = useState<Alert[]>([]);
  const [center, setCenter] = useState(defaultCenter);
  const [selectedAlerta, setSelectedAlerta] = useState<Alert | null>(null);
  
  // Estados para patrullas
  const [patrullas, setPatrullas] = useState<PatrullaUbicacion[]>([]);
  const [mostrarPatrullas, setMostrarPatrullas] = useState(false);
  const [selectedPatrulla, setSelectedPatrulla] = useState<PatrullaUbicacion | null>(null);

  // Estados para sistema de rutas
  const [activeRoutes, setActiveRoutes] = useState<Map<string, ActiveRoute>>(new Map());
  const [mostrarRutas, setMostrarRutas] = useState(false);
  const [routeUpdateTimers, setRouteUpdateTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [routeDetails, setRouteDetails] = useState<{[key: string]: {distance: string, duration: string}}>({});

  // 🆕 Estados para notificaciones elegantes
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  // 🆕 Estado para última actualización
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 🔥 FUNCIONES PARA SISTEMA DE PRIORIDADES

  // 🎨 Obtener color basado en nivel de urgencia
  const getUrgencyColor = (alert: Alert): string => {
    // Si no tiene el campo, usar color por defecto
    if (!alert.nivelUrgencia) return '#FFD700'; // Amarillo por defecto
    
    switch (alert.nivelUrgencia) {
      case 'critica':
        return '#FF0000'; // Rojo
      case 'media':
        return '#FF8C00'; // Naranja
      case 'baja':
      default:
        return '#FFD700'; // Amarillo
    }
  };

  // 📏 Obtener tamaño del marcador basado en urgencia
  const getMarkerSize = (alert: Alert): number => {
    // Si no tiene el campo, usar tamaño por defecto
    if (!alert.nivelUrgencia) return 30;
    
    switch (alert.nivelUrgencia) {
      case 'critica':
        return 50;
      case 'media':
        return 40;
      case 'baja':
      default:
        return 30;
    }
  };

  // 🎯 Obtener peso de la stroke para rutas basado en urgencia
  const getRouteStrokeWeight = (alert: Alert): number => {
    // Si no tiene el campo, usar peso por defecto
    if (!alert.nivelUrgencia) return 4;
    
    switch (alert.nivelUrgencia) {
      case 'critica':
        return 6;
      case 'media':
        return 5;
      case 'baja':
      default:
        return 4;
    }
  };

  // ⏰ Calcular tiempo transcurrido desde creación
  const getTimeSinceCreated = (alert: Alert): string => {
    if (!alert.fechaCreacion) return '';
    
    const now = new Date();
    const created = new Date(alert.fechaCreacion);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins}min`;
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ${diffMins % 60}min`;
    }
  };

  // 🚨 Verificar si una alerta debe considerarse "sin señal"
  const isSinSenal = (alert: Alert): boolean => {
    if (!alert.ultimaActivacion) return false;
    
    const now = new Date();
    const lastActivation = new Date(alert.ultimaActivacion);
    const diffMs = now.getTime() - lastActivation.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    return diffMins > 30; // Más de 30 min sin datos
  };

  // 🆕 Función para mostrar notificaciones elegantes
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setNotification({ message, type, visible: true });
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 4000);
  };

  // 🆕 Función para cargar alertas desde la base de datos
  const loadAlertasFromDatabase = async (isAutoRefresh = false) => {
    try {
      // � TEMPORALMENTE usar endpoint original mientras se arreglan los nuevos métodos
      const response = await api.get<Alert[]>("/alerta/activas"); // 🔥 USAR ENDPOINT ACTIVAS
      
      // 🔥 DEBUG: Log detallado con nuevos campos
      console.log(`📊 Alertas recibidas del backend:`, response.data.map(alert => ({
        nombre: alert.nombre,
        estado: alert.estado,
        device_id: alert.device_id,
        timestamp: alert.timestamp,
        // 🔥 NUEVOS CAMPOS (pueden ser undefined en datos existentes)
        cantidadActivaciones: alert.cantidadActivaciones,
        nivelUrgencia: alert.nivelUrgencia,
        esRecurrente: alert.esRecurrente
      })));
      
      // 🔥 FILTRAR alertas resueltas, archivadas Y VENCIDAS
      const alertasActivas = response.data.filter(alert => {
        const estado = alert.estado?.toLowerCase()?.trim();
        return !(estado === 'resuelto' || estado === 'resuelta' || estado === 'finalizada' || estado === 'finalizado' || estado === 'no-atendida' || estado === 'vencida');
      });
      
      console.log(`📊 Alertas después del filtro: ${alertasActivas.length}/${response.data.length}`);
      
      // Procesar alertas con geocoding
      const alertsWithAddresses = await Promise.all(
        alertasActivas.map(async (alert) => {
          if (!alert.direccion && alert.lat && alert.lon) {
            try {
              const address = await getAddressFromCoords(alert.lat, alert.lon);
              return { ...alert, direccion: address };
            } catch (error) {
              console.error('Error geocoding alert:', error);
              return { ...alert, direccion: `${alert.lat}, ${alert.lon}` };
            }
          }
          return alert;
        })
      );

      // 🔥 DETECTAR si hay alertas más nuevas del mismo dispositivo (lógica backend 10min)
      const alertasUnicas = filterDuplicateAlerts(alertsWithAddresses);

      console.log(`📊 Alertas después del filtro de duplicados: ${alertasUnicas.length}/${alertsWithAddresses.length}`);

      setAlertas(alertasUnicas);
      setLastUpdate(new Date()); // 🆕 Actualizar timestamp
      
      if (isAutoRefresh) {
        console.log(`🔄 Refresh automático completado: ${alertasUnicas.length} alertas activas (filtradas: ${response.data.length - alertasUnicas.length})`);
      } else {
        console.log(`✅ Alertas cargadas desde BD: ${alertasUnicas.length} activas de ${response.data.length} totales`);
      }
    } catch (error) {
      console.error("Error cargando alertas:", error);
      if (!isAutoRefresh) {
        showNotification('Error cargando alertas desde la base de datos', 'error');
      }
    }
  };

  // 🔥 Función para filtrar alertas duplicadas del mismo dispositivo (lógica backend)
  const filterDuplicateAlerts = (alerts: Alert[]): Alert[] => {
    const deviceMap = new Map<string, Alert>();
    
    alerts.forEach(alert => {
      if (!alert.device_id || alert.device_id.trim() === '') {
        // Para alertas sin device_id válido, usar un ID único basado en nombre+timestamp
        const uniqueKey = `${alert.nombre}_${alert.timestamp}`;
        deviceMap.set(uniqueKey, alert);
        return;
      }
      
      const existing = deviceMap.get(alert.device_id);
      if (!existing) {
        deviceMap.set(alert.device_id, alert);
      } else {
        // Mantener solo la alerta más reciente del mismo dispositivo
        const existingTime = new Date(existing.timestamp).getTime();
        const currentTime = new Date(alert.timestamp).getTime();
        
        if (currentTime > existingTime) {
          console.log(`🔄 Reemplazando alerta duplicada para dispositivo ${alert.device_id}: ${existing.nombre} → ${alert.nombre}`);
          deviceMap.set(alert.device_id, alert);
        }
      }
    });
    
    return Array.from(deviceMap.values());
  };

  // 🆕 ============================================================================
  // VALIDACIONES Y RESTRICCIONES DE RUTAS (IGUAL QUE FLUTTER)
  // ============================================================================

  // Validar si se puede crear una ruta (basado en las restricciones de Flutter)
  const canCreateRoute = (patrulla: PatrullaUbicacion, alerta: Alert): { valid: boolean, reason?: string } => {
    // 1. Verificar que la patrulla esté activa
    if (patrulla.estado !== 'Activa') {
      return { valid: false, reason: 'La patrulla debe estar activa para crear rutas' };
    }

    // 2. Verificar que la alerta esté en estado válido
    if (alerta.estado && alerta.estado === 'resuelto') {
      return { valid: false, reason: 'No se puede crear ruta hacia alertas ya resueltas' };
    }

    // 3. Verificar distancia máxima (ejemplo: 50km)
    const distance = calculateDistance(
      { lat: patrulla.lat, lng: patrulla.lon },
      { lat: alerta.lat, lng: alerta.lon }
    );
    
    const MAX_ROUTE_DISTANCE = 50000; // 50km en metros
    if (distance > MAX_ROUTE_DISTANCE) {
      return { 
        valid: false, 
        reason: `Distancia muy grande: ${(distance/1000).toFixed(1)}km. Máximo permitido: ${MAX_ROUTE_DISTANCE/1000}km` 
      };
    }

    // 4. Verificar que la patrulla no esté demasiado desactualizada (último reporte > 30 minutos)
    const MAX_UPDATE_MINUTES = 30;
    if (patrulla.minutosDesdeUltimaActualizacion > MAX_UPDATE_MINUTES) {
      return { 
        valid: false, 
        reason: `Ubicación de patrulla muy antigua: ${patrulla.minutosDesdeUltimaActualizacion} min. Máximo: ${MAX_UPDATE_MINUTES} min` 
      };
    }

    // 5. Verificar que no haya demasiadas rutas activas por patrulla (máximo 2)
    const MAX_ROUTES_PER_PATROL = 2;
    const routesForPatrol = Array.from(activeRoutes.values()).filter(r => r.patrullaId === patrulla.patrulleroId);
    if (routesForPatrol.length >= MAX_ROUTES_PER_PATROL) {
      return { 
        valid: false, 
        reason: `Patrulla ya tiene ${routesForPatrol.length} rutas activas. Máximo permitido: ${MAX_ROUTES_PER_PATROL}` 
      };
    }

    return { valid: true };
  };

  // 🆕 ============================================================================
  // SISTEMA HÍBRIDO DE RUTAS (BASADO EN FLUTTER)
  // ============================================================================

  // Helper: Calcular distancia entre dos puntos
  const calculateDistance = (point1: RoutePoint, point2: RoutePoint): number => {
    const R = 6371e3; // Radio de la Tierra en metros
    const φ1 = point1.lat * Math.PI/180;
    const φ2 = point2.lat * Math.PI/180;
    const Δφ = (point2.lat-point1.lat) * Math.PI/180;
    const Δλ = (point2.lng-point1.lng) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distancia en metros
  };

  // Helper: Encontrar punto más cercano en polyline
  const findNearestPointOnPolyline = (poly: RoutePoint[], pos: RoutePoint) => {
    if (poly.length === 0) return { index: 0, point: pos, distance: 0 };
    
    let bestDist = Infinity;
    let bestPoint = poly[0];
    let bestIndex = 0;

    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];

      // Proyección simple en el segmento a-b
      const dx = b.lng - a.lng;
      const dy = b.lat - a.lat;
      const denom = dx * dx + dy * dy;
      let t = 0;
      
      if (denom > 0) {
        t = Math.max(0, Math.min(1, ((pos.lng - a.lng) * dx + (pos.lat - a.lat) * dy) / denom));
      }

      const projLng = a.lng + t * dx;
      const projLat = a.lat + t * dy;
      const proj = { lat: projLat, lng: projLng };

      const dist = calculateDistance(proj, pos);
      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = proj;
        bestIndex = i;
      }
    }

    return { index: bestIndex, point: bestPoint, distance: bestDist };
  };

  // Recortar polyline desde posición actual (trimming)
  const trimPolylineFromPosition = (poly: RoutePoint[], pos: RoutePoint): RoutePoint[] => {
    if (poly.length === 0) return [];

    const nearest = findNearestPointOnPolyline(poly, pos);
    const newPoly = [nearest.point];
    
    for (let i = nearest.index + 1; i < poly.length; i++) {
      newPoly.push(poly[i]);
    }

    // Si el punto proyectado está muy lejos, usar posición actual como inicio
    if (calculateDistance(pos, newPoly[0]) > 15.0) {
      newPoly.unshift(pos);
    }

    return newPoly;
  };

  // Determinar si necesitamos nueva ruta
  const shouldRequestNewRoute = (route: ActiveRoute, currentPos: RoutePoint): boolean => {
    if (route.originalCompleteRoute.length === 0) return true;
    if (route.isRequestingNewRoute) return false;

    // 1. Verificar desviación de la ruta original
    const nearest = findNearestPointOnPolyline(route.originalCompleteRoute, currentPos);
    if (nearest.distance > ROUTE_DEVIATION_THRESHOLD) {
      console.log(`🔄 Desviación de ${nearest.distance.toFixed(1)}m > ${ROUTE_DEVIATION_THRESHOLD}m - Nueva ruta necesaria`);
      return true;
    }

    // 2. Verificar tiempo desde última petición
    if (route.lastDirectionsRequest) {
      const timeSinceRequest = (new Date().getTime() - route.lastDirectionsRequest.getTime()) / 1000;
      if (timeSinceRequest > MAX_REQUERY_INTERVAL_SECONDS) {
        console.log(`🔄 ${timeSinceRequest.toFixed(0)}s desde última petición > ${MAX_REQUERY_INTERVAL_SECONDS}s - Nueva ruta por tiempo`);
        return true;
      }
    }

    // 3. Verificar movimiento significativo desde último origen
    const distanceFromLastOrigin = calculateDistance(
      { lat: route.lastOriginLat, lng: route.lastOriginLng },
      currentPos
    );
    
    if (distanceFromLastOrigin > MIN_MOVEMENT_THRESHOLD * 3) {
      console.log(`🔄 Movimiento de ${distanceFromLastOrigin.toFixed(1)}m desde último origen - Nueva ruta`);
      return true;
    }

    return false;
  };

  // Obtener ruta usando Google Maps DirectionsService (correcto para navegador)
  const getRouteFromGoogle = async (origin: RoutePoint, destination: RoutePoint): Promise<RoutePoint[]> => {
    try {
      // Verificar que Google Maps esté cargado
      if (!window.google?.maps) {
        console.error('❌ Google Maps no está cargado');
        return [];
      }

      // 🔧 Usar DirectionsService del navegador (correcto método)
      const directionsService = new google.maps.DirectionsService();
      
      const request = {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS
        },
        avoidFerries: false,
        avoidHighways: false,
        avoidTolls: true, // Evitar peajes
        region: 'pe',
        language: 'es'
      };

      console.log('🌐 Solicitando ruta por carreteras usando DirectionsService...');

      return new Promise((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
            const route = result.routes[0];
            const polylinePoints: RoutePoint[] = [];
            
            // Extraer todos los puntos del path
            route.legs.forEach(leg => {
              leg.steps.forEach(step => {
                step.path.forEach(point => {
                  polylinePoints.push({
                    lat: point.lat(),
                    lng: point.lng()
                  });
                });
              });
            });
            
            console.log(`✅ Ruta por carreteras obtenida: ${polylinePoints.length} puntos`);
            
            // Extraer información adicional de la ruta
            if (route.legs?.[0]) {
              const leg = route.legs[0];
              const routeKey = `${origin.lat}_${origin.lng}_${destination.lat}_${destination.lng}`;
              setRouteDetails(prev => ({
                ...prev,
                [routeKey]: {
                  distance: leg.distance?.text || 'N/A',
                  duration: leg.duration?.text || 'N/A'
                }
              }));
            }
            
            resolve(polylinePoints);
          } else {
            console.error('❌ Error en DirectionsService:', status);
            
            // Fallback: crear línea recta solo si falla completamente
            console.log('⚠️ Usando línea recta como fallback...');
            resolve([origin, destination]);
          }
        });
      });
    } catch (error) {
      console.error('❌ Exception en DirectionsService:', error);
      // Fallback: línea recta
      return [origin, destination];
    }
  };

  // Crear nueva ruta para una patrulla hacia una alerta
  const createRoute = async (patrulla: PatrullaUbicacion, alerta: Alert) => {
    const routeKey = `${patrulla.patrulleroId}_${alerta.device_id}`;
    
    // Verificar si ya existe una ruta activa
    if (activeRoutes.has(routeKey)) {
      console.log('⚠️ Ya existe una ruta activa para esta patrulla/alerta');
      return;
    }

    console.log(`🚀 Creando ruta: Patrulla ${patrulla.patrulleroId} → Alerta ${alerta.nombre}`);

    const origin = { lat: patrulla.lat, lng: patrulla.lon };
    const destination = { lat: alerta.lat, lng: alerta.lon };

    // Obtener ruta inicial
    const routePoints = await getRouteFromGoogle(origin, destination);
    
    if (routePoints.length > 0) {
      const newRoute: ActiveRoute = {
        alertId: alerta.device_id || '',
        patrullaId: patrulla.patrulleroId,
        points: routePoints,
        originalCompleteRoute: [...routePoints],
        lastOriginLat: origin.lat,
        lastOriginLng: origin.lng,
        lastDirectionsRequest: new Date(),
        isRequestingNewRoute: false
      };

      // Agregar ruta a estado
      setActiveRoutes(prev => new Map(prev.set(routeKey, newRoute)));
      
      // Iniciar sistema de actualización automática
      startRouteUpdates(routeKey, patrulla, alerta);
      
      console.log('✅ Ruta creada exitosamente');
    } else {
      console.error('❌ No se pudo crear la ruta');
      // Crear ruta directa como fallback
      const directRoute: ActiveRoute = {
        alertId: alerta.device_id || '',
        patrullaId: patrulla.patrulleroId,
        points: [origin, destination],
        originalCompleteRoute: [origin, destination],
        lastOriginLat: origin.lat,
        lastOriginLng: origin.lng,
        lastDirectionsRequest: new Date(),
        isRequestingNewRoute: false
      };
      
      setActiveRoutes(prev => new Map(prev.set(routeKey, directRoute)));
      console.log('⚠️ Ruta directa creada como fallback');
    }
  };

  // Iniciar sistema de actualización de ruta
  const startRouteUpdates = (routeKey: string, patrulla: PatrullaUbicacion, alerta: Alert) => {
    // Limpiar timer existente si existe
    const existingTimer = routeUpdateTimers.get(routeKey);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(() => {
      updateRouteIntelligently(routeKey, alerta);
    }, ROUTE_UPDATE_INTERVAL_SECONDS * 1000);

    setRouteUpdateTimers(prev => new Map(prev.set(routeKey, timer)));
    console.log(`🚀 Sistema de actualización iniciado para ruta ${routeKey}`);
  };

  // Actualizar ruta inteligentemente
  const updateRouteIntelligently = async (routeKey: string, alerta: Alert) => {
    const route = activeRoutes.get(routeKey);
    if (!route) return;

    // Buscar patrulla actual
    const patrulla = patrullas.find(p => p.patrulleroId === route.patrullaId);
    if (!patrulla) return;

    const currentPos = { lat: patrulla.lat, lng: patrulla.lon };
    
    if (shouldRequestNewRoute(route, currentPos)) {
      // Re-request: Nueva ruta de Google
      await requestNewRouteFromGoogle(routeKey, currentPos, alerta);
    } else {
      // Trimming: Solo recortar ruta existente
      updateRouteWithTrimming(routeKey, currentPos);
    }
  };

  // Solicitar nueva ruta de Google
  const requestNewRouteFromGoogle = async (routeKey: string, currentPos: RoutePoint, alerta: Alert) => {
    const route = activeRoutes.get(routeKey);
    if (!route || route.isRequestingNewRoute) return;

    console.log('🌐 Solicitando nueva ruta desde Google Directions...');
    
    // Marcar como solicitando nueva ruta
    const updatedRoute = { ...route, isRequestingNewRoute: true };
    setActiveRoutes(prev => new Map(prev.set(routeKey, updatedRoute)));

    try {
      const destination = { lat: alerta.lat, lng: alerta.lon };
      const newPoints = await getRouteFromGoogle(currentPos, destination);
      
      if (newPoints.length > 0) {
        const finalRoute = {
          ...updatedRoute,
          points: newPoints,
          originalCompleteRoute: [...newPoints],
          lastOriginLat: currentPos.lat,
          lastOriginLng: currentPos.lng,
          lastDirectionsRequest: new Date(),
          isRequestingNewRoute: false
        };

        setActiveRoutes(prev => new Map(prev.set(routeKey, finalRoute)));
        console.log(`✅ Nueva ruta obtenida: ${newPoints.length} puntos`);
      } else {
        console.log('❌ Error obteniendo nueva ruta - usando trimming como fallback');
        updateRouteWithTrimming(routeKey, currentPos);
      }
    } catch (error) {
      console.error('❌ Exception en nueva ruta:', error);
      updateRouteWithTrimming(routeKey, currentPos);
    }
  };

  // Actualizar ruta con trimming
  const updateRouteWithTrimming = (routeKey: string, currentPos: RoutePoint) => {
    const route = activeRoutes.get(routeKey);
    if (!route || route.originalCompleteRoute.length === 0) return;

    const trimmedPoints = trimPolylineFromPosition(route.originalCompleteRoute, currentPos);
    const updatedRoute = {
      ...route,
      points: trimmedPoints,
      isRequestingNewRoute: false
    };

    setActiveRoutes(prev => new Map(prev.set(routeKey, updatedRoute)));
    console.log(`✂️ Ruta recortada: ${trimmedPoints.length} puntos restantes`);
  };

  // Eliminar ruta
  const removeRoute = (routeKey: string) => {
    // Limpiar timer
    const timer = routeUpdateTimers.get(routeKey);
    if (timer) {
      clearInterval(timer);
      setRouteUpdateTimers(prev => {
        const newMap = new Map(prev);
        newMap.delete(routeKey);
        return newMap;
      });
    }

    // Eliminar ruta
    setActiveRoutes(prev => {
      const newMap = new Map(prev);
      newMap.delete(routeKey);
      return newMap;
    });

    console.log(`🛑 Ruta eliminada: ${routeKey}`);
  };

  // ============================================================================
  // FIN DEL SISTEMA DE RUTAS
  // ============================================================================

  // 🆕 Función para mostrar ruta desde InfoWindow de alerta (con lógica de asignación)
  const handleCreateRouteToAlert = (alerta: Alert) => {
    if (!mostrarPatrullas || patrullas.length === 0) {
      showNotification('⚠️ Primero debes mostrar las patrullas en el mapa para crear rutas', 'warning');
      return;
    }

    // 🔧 LÓGICA CLAVE: Verificar si la alerta ya está asignada a una patrulla específica
    let targetPatrulla: PatrullaUbicacion | null = null;

    if (alerta.patrulleroAsignado) {
      // ✅ CASO 1: Alerta YA ASIGNADA - buscar solo esa patrulla específica
      console.log(`🎯 Alerta asignada a patrulla ${alerta.patrulleroAsignado}, buscando esa patrulla...`);
      
      targetPatrulla = patrullas.find(p => p.patrulleroId === alerta.patrulleroAsignado) || null;
      
      if (!targetPatrulla) {
        showNotification(`❌ La patrulla asignada ${alerta.patrulleroAsignado} no está disponible en el mapa`, 'error');
        return;
      }
      
      if (targetPatrulla.estado !== 'Activa') {
        showNotification(`❌ La patrulla asignada ${alerta.patrulleroAsignado} no está activa`, 'warning');
        return;
      }
      
      console.log(`✅ Patrulla asignada encontrada: ${targetPatrulla.patrulleroId} (${targetPatrulla.estado})`);
      
    } else {
      // ✅ CASO 2: Alerta DISPONIBLE - buscar patrulla más cercana
      console.log('🔍 Alerta disponible, buscando patrulla más cercana...');
      
      let minDistance = Infinity;
      
      patrullas.forEach((patrulla: PatrullaUbicacion) => {
        // Solo patrullas activas pueden tomar alertas nuevas
        if (patrulla.estado !== 'Activa') return;
        
        const distance = calculateDistance(
          { lat: patrulla.lat, lng: patrulla.lon },
          { lat: alerta.lat, lng: alerta.lon }
        );
        
        // Restricción: máximo 50km de distancia
        if (distance > 50000) return;
        
        if (distance < minDistance) {
          minDistance = distance;
          targetPatrulla = patrulla;
        }
      });
      
      if (!targetPatrulla) {
        showNotification('❌ No hay patrullas activas disponibles cerca (máx. 50km)', 'error');
        return;
      }
      
      const distanceKm = minDistance > 1000 ? `${(minDistance/1000).toFixed(1)}km` : `${minDistance.toFixed(0)}m`;
      console.log(`✅ Patrulla más cercana: ${(targetPatrulla as PatrullaUbicacion).patrulleroId} (${distanceKm})`);
    }

    // Crear ruta con la patrulla seleccionada (asignada o más cercana)
    if (targetPatrulla) {
      createRoute(targetPatrulla, alerta);
      setMostrarRutas(true); // 🔥 FORZAR activación de rutas al crear una
      setSelectedAlerta(null); // Cerrar InfoWindow automáticamente
      
      // Mensaje específico según el caso
      const mensaje = alerta.patrulleroAsignado 
        ? `🗺️ Ruta hacia patrulla asignada ${alerta.patrulleroAsignado}`
        : `🗺️ Ruta activada hacia ${alerta.nombre}`;
      
      showNotification(mensaje, 'success');
      console.log(`✅ Ruta creada: ${targetPatrulla.patrulleroId} → ${alerta.nombre}`);
    }
  };

  // 🆕 Función para alternar visibilidad de rutas
  const toggleMostrarRutas = () => {
    if (mostrarRutas) {
      // Si se ocultan las rutas, limpiar todas las rutas activas y timers
      console.log('🛑 Ocultando rutas y limpiando todas las rutas activas...');
      activeRoutes.forEach((_, routeKey) => {
        removeRoute(routeKey);
      });
    }
    setMostrarRutas(!mostrarRutas);
    console.log(`🗺️ Modo rutas: ${!mostrarRutas ? 'ACTIVADO' : 'DESACTIVADO'}`);
  };

  // 🆕 Cleanup cuando se desmonta el componente
  useEffect(() => {
    return () => {
      // Limpiar todos los timers al desmontar
      routeUpdateTimers.forEach(timer => clearInterval(timer));
    };
  }, [routeUpdateTimers]);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_URL)
      .withAutomaticReconnect()
      .build();

    connection.on("RecibirAlerta", async (alerta: Alert) => {
      // 🔥 IMPORTANTE: Verificar estado de la alerta - no procesar resueltas
      const estado = alerta.estado?.toLowerCase();
      if (estado === 'resuelto' || estado === 'resuelta' || estado === 'finalizada') {
        console.log('⚠️ Alerta resuelta recibida por SignalR - ignorando');
        return;
      }

      // Crear copia local para no modificar datos originales
      const alertaLocal = { ...alerta };
      
      // Convertir coordenadas a dirección (solo para UI)
      try {
        const direccion = await getAddressFromCoords(alerta.lat, alerta.lon);
        alertaLocal.direccion = direccion;
      } catch (error) {
        console.error('Error obteniendo dirección:', error);
        alertaLocal.direccion = `${alerta.lat}, ${alerta.lon}`;
      }

      // 🔄 Evitar duplicados: verificar si la alerta ya existe
      setAlertas((prev) => {
        const existe = prev.some(alert => 
          alert.device_id === alertaLocal.device_id && 
          alert.timestamp === alertaLocal.timestamp
        );
        if (existe) {
          console.log('⚠️ Alerta duplicada detectada por SignalR, no agregando');
          return prev;
        }

        // 🔥 LÓGICA CLAVE: Si ya existe una alerta del mismo dispositivo, reemplazarla
        const alertasFiltradas = prev.filter(alert => alert.device_id !== alertaLocal.device_id);
        console.log('🆕 Nueva alerta recibida por SignalR');
        return [...alertasFiltradas, alertaLocal];
      });
      
      setCenter({ lat: alerta.lat, lng: alerta.lon });
    });

    connection.start()
      .then(() => console.log("Conectado a SignalR"))
      .catch(err => console.error("Error conectando a SignalR", err));

    return () => {
      connection.stop();
    };
  }, []);

  // Nuevo efecto para cargar patrullas cada 10 segundos
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const cargarPatrullas = async () => {
      if (mostrarPatrullas) {
        try {
          const response = await api.get<PatrullaUbicacion[]>('/patrulla/ubicaciones');
          setPatrullas(response.data);
        } catch (error) {
          console.error("Error cargando patrullas:", error);
        }
      }
    };

    if (mostrarPatrullas) {
      cargarPatrullas(); // Cargar inmediatamente
      interval = setInterval(cargarPatrullas, 10000); // Cada 10 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mostrarPatrullas]);

  // 🆕 useEffect para carga inicial de alertas
  useEffect(() => {
    loadAlertasFromDatabase();
  }, []);

  // 🆕 useEffect para refresh automático de alertas cada 30 segundos
  useEffect(() => {
    console.log('🕐 Iniciando refresh automático de alertas cada 30 segundos...');
    
    const interval = setInterval(() => {
      console.log('⏰ Ejecutando refresh automático...');
      loadAlertasFromDatabase(true);
    }, 30000); // 30 segundos

    return () => {
      clearInterval(interval);
      console.log('🛑 Timer de refresh automático limpiado');
    };
  }, []);

  const togglePatrullas = () => {
    setMostrarPatrullas(!mostrarPatrullas);
    if (!mostrarPatrullas) {
      setPatrullas([]); // Limpiar cuando se ocultan
    }
  };

  // Funciones de zoom
  const zoomIn = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom() || 13;
      const newZoom = Math.min(currentZoom + 1, 20);
      mapRef.current.setZoom(newZoom);
      setZoom(newZoom);
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom() || 13;
      const newZoom = Math.max(currentZoom - 1, 1);
      mapRef.current.setZoom(newZoom);
      setZoom(newZoom);
    }
  };

  // Función para formatear minutos a horas y minutos
  const formatearTiempo = (minutos: number) => {
    if (minutos < 60) {
      return `${Math.round(minutos)} min`;
    } else {
      const horas = Math.floor(minutos / 60);
      const mins = Math.round(minutos % 60);
      return `${horas}h ${mins}min`;
    }
  };

  // Versión con emoji
  // Versión alternativa más simple del carro patrulla
  const getPatrullaIcon = (estado: string) => {
    const bgColor = estado === 'Activa' ? '#3B82F6' : '#6B7280';
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="42" height="42" viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">
          <!-- Círculo de fondo -->
          <circle cx="21" cy="21" r="19" fill="${bgColor}" stroke="white" stroke-width="3"/>
          
          <!-- Carro patrulla simplificado -->
          <g transform="translate(21, 21)">
            <!-- Cuerpo principal del vehículo -->
            <rect x="-10" y="-3" width="20" height="5" rx="1" fill="white"/>
            
            <!-- Cabina -->
            <rect x="-6" y="-6" width="12" height="3" rx="1" fill="white"/>
            
            <!-- Ventana delantera -->
            <rect x="6" y="-5" width="3" height="2" rx="0.5" fill="${bgColor}"/>
            
            <!-- Ventanas laterales -->
            <rect x="-5" y="-5" width="4" height="2" rx="0.5" fill="${bgColor}"/>
            <rect x="1" y="-5" width="4" height="2" rx="0.5" fill="${bgColor}"/>
            
            <!-- Ruedas -->
            <circle cx="-6" cy="3" r="2" fill="white" stroke="${bgColor}" stroke-width="1"/>
            <circle cx="6" cy="3" r="2" fill="white" stroke="${bgColor}" stroke-width="1"/>
            
            <!-- Luces de emergencia en el techo -->
            <ellipse cx="-1" cy="-7" rx="2" ry="1" fill="#FF4444"/>
            <ellipse cx="1" cy="-7" rx="2" ry="1" fill="#4444FF"/>
            
            <!-- Número de patrulla -->
            <text x="0" y="1" text-anchor="middle" font-family="Arial" font-size="4" font-weight="bold" fill="${bgColor}">P</text>
          </g>
        </svg>
      `)}`,
      scaledSize: new window.google.maps.Size(42, 42),
      anchor: new window.google.maps.Point(21, 21),
    };
  };

  if (!isLoaded) return <div>Cargando mapa...</div>;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          disableDefaultUI: true, // Ocultar TODOS los controles por defecto
        }}
      >
        {/* 🔥 Polylines de rutas activas con colores de urgencia */}
        {activeRoutes.size > 0 && Array.from(activeRoutes.values()).map((route) => {
          // Buscar la alerta correspondiente para obtener el color de urgencia
          const alerta = alertas.find(a => a.device_id === route.alertId || a.id === route.alertId);
          const strokeColor = alerta ? getUrgencyColor(alerta) : '#2563EB';
          const strokeWeight = alerta ? getRouteStrokeWeight(alerta) : 4;
          
          return (
            <Polyline
              key={`route_${route.patrullaId}_${route.alertId}`}
              path={route.points.map(p => ({ lat: p.lat, lng: p.lng }))}
              options={{
                strokeColor: strokeColor,
                strokeWeight: strokeWeight,
                strokeOpacity: 0.8,
                zIndex: 1000,
                geodesic: true, // Para que siga la curvatura de la tierra
                icons: [
                  {
                    icon: {
                      path: 'M 0,-1 0,1',
                      strokeOpacity: 1,
                      strokeWeight: strokeWeight,
                      strokeColor: strokeColor
                    },
                    offset: '0',
                    repeat: '20px'
                  }
                ]
              }}
            />
          );
        })}

        {/* 🔥 Marcadores de alertas con sistema de prioridades */}
        {alertas.map((alerta, i) => {
          const isAlertaSinSenal = isSinSenal(alerta);
          const urgencyColor = getUrgencyColor(alerta);
          const markerSize = getMarkerSize(alerta);
          
          return (
            <Marker
              key={`alerta-${i}`}
              position={{ lat: alerta.lat, lng: alerta.lon }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: markerSize / 5, // Convertir tamaño a scale
                fillColor: urgencyColor,
                fillOpacity: isAlertaSinSenal ? 0.6 : 1.0,
                strokeWeight: isAlertaSinSenal ? 3 : 2,
                strokeColor: isAlertaSinSenal ? '#666666' : '#FFFFFF',
                strokeOpacity: 1.0,
              }}
              label={{
                text: `${alerta.cantidadActivaciones || 1}${alerta.esRecurrente ? '🔁' : ''}`,
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
              title={`${alerta.nombre} - ${alerta.nivelUrgencia?.toUpperCase()} ${isAlertaSinSenal ? '(SIN SEÑAL)' : ''}`}
              onClick={() => {
                setSelectedAlerta(alerta);
                setSelectedPatrulla(null); // Cerrar info de patrulla si está abierta
              }}
            />
          );
        })}

        {/* Marcadores de patrullas */}
        {mostrarPatrullas && patrullas.map((patrulla) => (
          <Marker
            key={`patrulla-${patrulla.patrulleroId}`}
            position={{ lat: patrulla.lat, lng: patrulla.lon }}
            icon={getPatrullaIcon(patrulla.estado)}
            onClick={() => {
              setSelectedPatrulla(patrulla);
              setSelectedAlerta(null); // Cerrar info de alerta si está abierta
            }}
            title={`Patrulla ${patrulla.patrulleroId} - ${patrulla.estado}`}
          />
        ))}

        {/* 🔥 InfoWindow mejorado con información de prioridad */}
        {selectedAlerta && (
          <InfoWindow
            position={{ lat: selectedAlerta.lat, lng: selectedAlerta.lon }}
            onCloseClick={() => setSelectedAlerta(null)}
          >
            <div style={{ minWidth: '300px' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                🚨 {selectedAlerta.nombre} 
                {selectedAlerta.esRecurrente && <span style={{ marginLeft: '8px', color: '#DC2626' }}>🔁 RECURRENTE</span>}
              </h4>
              
              {selectedAlerta.apellido && <p><b>Apellido:</b> {selectedAlerta.apellido}</p>}
              {selectedAlerta.dni && <p><b>DNI:</b> {selectedAlerta.dni}</p>}
              
              {/* 🔥 NIVEL DE URGENCIA */}
              <div style={{ marginBottom: '8px' }}>
                <b>Urgencia:</b> 
                <span style={{
                  marginLeft: '8px',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: selectedAlerta.nivelUrgencia === 'critica' ? '#FEE2E2' : 
                                 selectedAlerta.nivelUrgencia === 'media' ? '#FEF3C7' : '#FEF9C3',
                  color: selectedAlerta.nivelUrgencia === 'critica' ? '#DC2626' : 
                        selectedAlerta.nivelUrgencia === 'media' ? '#D97706' : '#CA8A04'
                }}>
                  {selectedAlerta.nivelUrgencia === 'critica' ? '🔴 CRÍTICA' : 
                   selectedAlerta.nivelUrgencia === 'media' ? '🟠 MEDIA' : '🟡 BAJA'}
                </span>
              </div>

              {/* 🔥 ESTADÍSTICAS DE ACTIVACIONES */}
              <div style={{ marginBottom: '8px' }}>
                <b>Activaciones:</b> <span style={{ color: '#DC2626', fontWeight: 'bold' }}>{selectedAlerta.cantidadActivaciones || 1}</span>
                {(selectedAlerta.cantidadActivaciones || 1) > 1 && (
                  <small style={{ color: '#6B7280', marginLeft: '8px' }}>
                    (múltiples activaciones)
                  </small>
                )}
              </div>

              {/* 🔥 TIEMPO TRANSCURRIDO */}
              <div style={{ marginBottom: '8px' }}>
                <b>Tiempo:</b> <span style={{ color: '#059669' }}>{getTimeSinceCreated(selectedAlerta)}</span>
                {isSinSenal(selectedAlerta) && (
                  <span style={{ color: '#DC2626', marginLeft: '8px', fontWeight: 'bold' }}>
                    📵 SIN SEÑAL
                  </span>
                )}
              </div>
              
              {/* 🔥 MOSTRAR ESTADO con colores apropiados */}
              <div style={{ marginBottom: '8px' }}>
                <b>Estado:</b> 
                <span style={{
                  marginLeft: '8px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: 
                    selectedAlerta.estado === 'Despachada' || selectedAlerta.estado === 'disponible' ? '#FEF2F2' :
                    selectedAlerta.estado === 'tomada' ? '#FEF3C7' :
                    selectedAlerta.estado === 'enCamino' ? '#DBEAFE' :
                    selectedAlerta.estado === 'resuelto' ? '#F0FDF4' : '#F3F4F6',
                  color:
                    selectedAlerta.estado === 'Despachada' || selectedAlerta.estado === 'disponible' ? '#DC2626' :
                    selectedAlerta.estado === 'tomada' ? '#D97706' :
                    selectedAlerta.estado === 'enCamino' ? '#2563EB' :
                    selectedAlerta.estado === 'resuelto' ? '#059669' : '#6B7280'
                }}>
                  {selectedAlerta.estado === 'Despachada' ? 'Disponible' : 
                   selectedAlerta.estado === 'tomada' ? 'Tomada' :
                   selectedAlerta.estado === 'enCamino' ? 'En Camino' :
                   selectedAlerta.estado === 'resuelto' ? 'Resuelta' :
                   selectedAlerta.estado || 'Disponible'}
                </span>
              </div>
              
              {/* 🆕 Mostrar información de asignación */}
              {selectedAlerta.patrulleroAsignado ? (
                <div style={{ 
                  backgroundColor: '#FEF3C7', 
                  border: '1px solid #F59E0B',
                  borderRadius: '6px',
                  padding: '8px',
                  marginTop: '8px'
                }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#92400E' }}>
                    🚔 Asignada a: {selectedAlerta.patrulleroAsignado}
                  </p>
                  {selectedAlerta.fechaTomada && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#92400E' }}>
                      Tomada: {new Date(selectedAlerta.fechaTomada).toLocaleString()}
                    </p>
                  )}
                  {selectedAlerta.fechaEnCamino && (
                    <p style={{ margin: 0, fontSize: '12px', color: '#92400E' }}>
                      En Camino: {new Date(selectedAlerta.fechaEnCamino).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ 
                  backgroundColor: '#FEF2F2', 
                  border: '1px solid #EF4444',
                  borderRadius: '6px',
                  padding: '8px',
                  marginTop: '8px'
                }}>
                  <p style={{ margin: 0, fontWeight: 'bold', color: '#DC2626' }}>
                    ⚠️ Alerta Disponible
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#DC2626' }}>
                    Sin patrulla asignada
                  </p>
                </div>
              )}
              
              <p><b>Dirección:</b> {selectedAlerta.direccion || 'Cargando...'}</p>
              <p><b>Batería:</b> {selectedAlerta.bateria}%</p>
              <p><b>Timestamp:</b> {selectedAlerta.timestamp}</p>
              <p><b>Device ID:</b> {selectedAlerta.device_id}</p>
              
              {/* 🆕 Botón para mostrar ruta */}
              <div style={{ marginTop: '12px' }}>
                <button
                  onClick={() => handleCreateRouteToAlert(selectedAlerta)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: selectedAlerta.patrulleroAsignado ? '#10B981' : '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}
                >
                  {selectedAlerta.patrulleroAsignado 
                    ? `🗺️ Ruta a ${selectedAlerta.patrulleroAsignado}`
                    : '🗺️ Mostrar Ruta'
                  }
                </button>
              </div>
            </div>
          </InfoWindow>
        )}

        {/* Nueva InfoWindow para patrullas */}
        {selectedPatrulla && (
          <InfoWindow
            position={{ lat: selectedPatrulla.lat, lng: selectedPatrulla.lon }}
            onCloseClick={() => setSelectedPatrulla(null)}
          >
            <div>
              <h4>🚔 Patrulla {selectedPatrulla.patrulleroId}</h4>
              <p><b>Estado:</b> 
                <span style={{ 
                  color: selectedPatrulla.estado === 'Activa' ? '#10B981' : '#EF4444',
                  fontWeight: 'bold'
                }}>
                  {selectedPatrulla.estado}
                </span>
              </p>
              <p><b>Última actualización:</b> {formatearTiempo(selectedPatrulla.minutosDesdeUltimaActualizacion)}</p>
              <p><b>Coordenadas:</b> {selectedPatrulla.lat.toFixed(4)}, {selectedPatrulla.lon.toFixed(4)}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* 🆕 Panel de información de rutas activas */}
      {mostrarRutas && activeRoutes.size > 0 && (
        <div style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 1000,
          backgroundColor: "white",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          maxWidth: "300px",
          border: "2px solid #2563EB"
        }}>
          <h4 style={{ margin: "0 0 12px 0", color: "#2563EB", fontWeight: "bold" }}>
            🗺️ Rutas Activas ({activeRoutes.size})
          </h4>
          {Array.from(activeRoutes.values()).map((route) => {
            const routeKey = `${route.patrullaId}_${route.alertId}`;
            const routeInfo = routeDetails[`${route.lastOriginLat}_${route.lastOriginLng}_${alertas.find(a => a.device_id === route.alertId)?.lat}_${alertas.find(a => a.device_id === route.alertId)?.lon}`];
            const alertaName = alertas.find(a => a.device_id === route.alertId)?.nombre || 'Alerta';
            
            return (
              <div key={routeKey} style={{
                padding: "8px",
                backgroundColor: "#F3F4F6",
                borderRadius: "6px",
                marginBottom: "8px",
                fontSize: "13px"
              }}>
                <div style={{ fontWeight: "bold" }}>
                  🚔 Patrulla {route.patrullaId} → 🚨 {alertaName}
                </div>
                {routeInfo && (
                  <div style={{ color: "#666", marginTop: "4px" }}>
                    📍 {routeInfo.distance} • ⏱️ {routeInfo.duration}
                  </div>
                )}
                <button
                  onClick={() => removeRoute(routeKey)}
                  style={{
                    marginTop: "6px",
                    padding: "4px 8px",
                    backgroundColor: "#EF4444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  ✕ Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Controles de zoom en esquina inferior izquierda */}
      <div style={{
        position: "absolute",
        bottom: "20px",
        left: "20px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {/* Botón Zoom In (+) */}
        <button
          onClick={zoomIn}
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "white",
            border: "2px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "20px",
            fontWeight: "bold",
            color: "#333",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          +
        </button>

        {/* Botón Zoom Out (-) */}
        <button
          onClick={zoomOut}
          style={{
            width: "40px",
            height: "40px",
            backgroundColor: "white",
            border: "2px solid #ddd",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "20px",
            fontWeight: "bold",
            color: "#333",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          −
        </button>
      </div>

      {/* 🆕 Botón para mostrar/ocultar rutas */}
      <div style={{
        position: "absolute",
        bottom: "140px",
        right: "20px",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}>
        <button
          onClick={toggleMostrarRutas}
          style={{
            padding: "12px 18px",
            backgroundColor: mostrarRutas ? "#10B981" : "#6B7280",
            color: "white",
            border: "none",
            borderRadius: "50px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span style={{ fontSize: "16px" }}>🗺️</span>
          {mostrarRutas ? "Ocultar Rutas" : "Mostrar Rutas"}
          {mostrarRutas && activeRoutes.size > 0 && (
            <span style={{
              backgroundColor: "rgba(255,255,255,0.3)",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "12px"
            }}>
              {activeRoutes.size}
            </span>
          )}
        </button>
      </div>

      {/* Botón para mostrar/ocultar patrullas */}
      <button
        onClick={togglePatrullas}
        style={{
          position: "absolute",
          bottom: "80px",
          right: "20px",
          zIndex: 1000,
          padding: "12px 18px",
          backgroundColor: mostrarPatrullas ? "#10B981" : "#6B7280",
          color: "white",
          border: "none",
          borderRadius: "50px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "600",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <span style={{ fontSize: "16px" }}>🚔</span>
        {mostrarPatrullas ? "Ocultar Patrullas" : "Mostrar Patrullas"}
        {mostrarPatrullas && (
          <span style={{
            backgroundColor: "rgba(255,255,255,0.3)",
            padding: "2px 8px",
            borderRadius: "12px",
            fontSize: "12px"
          }}>
            {patrullas.length}
          </span>
        )}
      </button>

      {/* 🆕 Indicador de última actualización */}
      {lastUpdate && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "20px",
          zIndex: 1500,
          backgroundColor: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          <span>🔄</span>
          <span>Actualizado: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      )}

      {/* 🆕 Sistema de notificaciones elegantes */}
      {notification.visible && (
        <div style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2000,
          backgroundColor: 
            notification.type === 'success' ? '#10B981' :
            notification.type === 'error' ? '#EF4444' :
            notification.type === 'warning' ? '#F59E0B' : '#3B82F6',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '400px',
          textAlign: 'center',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}

      {/* CSS para animación de notificaciones */}
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateX(-50%) translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(-50%) translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default MapView;