import React, { useEffect, useState, useRef } from "react";
import { Alert } from "../../types/alert";
import { PatrullaUbicacion } from "../../types/patrulla";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import * as signalR from "@microsoft/signalr";
import api from "../../services/api";

const GOOGLE_MAPS_API_KEY = "AIzaSyD_4MSV8UftvnM5JetkCZxHJTZRPkrtlpQ";
const SIGNALR_URL = "https://f704b00c52f8.ngrok-free.app/alertaHub";

const containerStyle = { width: "100%", height: "100vh" };
const defaultCenter = { lat: -18.0066, lng: -70.2463 };

const MapView = () => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(13);

  // Estados existentes
  const [alertas, setAlertas] = useState<Alert[]>([]);
  const [center, setCenter] = useState(defaultCenter);
  const [selectedAlerta, setSelectedAlerta] = useState<Alert | null>(null);
  
  // Nuevos estados para patrullas
  const [patrullas, setPatrullas] = useState<PatrullaUbicacion[]>([]);
  const [mostrarPatrullas, setMostrarPatrullas] = useState(false);
  const [selectedPatrulla, setSelectedPatrulla] = useState<PatrullaUbicacion | null>(null);

  // Efecto existente para SignalR
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(SIGNALR_URL)
      .withAutomaticReconnect()
      .build();

    connection.on("RecibirAlerta", (alerta: Alert) => {
      setAlertas((prev) => [...prev, alerta]);
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
        {/* Marcadores de alertas existentes */}
        {alertas.map((alerta, i) => (
          <Marker
            key={`alerta-${i}`}
            position={{ lat: alerta.lat, lng: alerta.lon }}
            label={alerta.nombre}
            onClick={() => {
              setSelectedAlerta(alerta);
              setSelectedPatrulla(null); // Cerrar info de patrulla si está abierta
            }}
          />
        ))}

        {/* Nuevos marcadores de patrullas */}
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

        {/* InfoWindow existente para alertas */}
        {selectedAlerta && (
          <InfoWindow
            position={{ lat: selectedAlerta.lat, lng: selectedAlerta.lon }}
            onCloseClick={() => setSelectedAlerta(null)}
          >
            <div>
              <h4>🚨 {selectedAlerta.nombre}</h4>
              <p><b>Apellido:</b> {selectedAlerta.apellido}</p>
              <p><b>DNI:</b> {selectedAlerta.dni}</p>
              <p><b>Batería:</b> {selectedAlerta.bateria}%</p>
              <p><b>Timestamp:</b> {selectedAlerta.timestamp}</p>
              <p><b>Device ID:</b> {selectedAlerta.device_id}</p>
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

      {/* Botón para mostrar/ocultar patrullas */}
      <button
        onClick={togglePatrullas}
        style={{
          position: "absolute",
          bottom: "20px",
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
        <span style={{ fontSize: "16px" }}></span>
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
    </div>
  );
};

export default MapView;