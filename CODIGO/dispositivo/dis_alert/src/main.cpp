#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <lmic.h>
#include <hal/hal.h>
#include <TinyGPS++.h>
#include "AXP20X.h" 

// ------------- lorawan (TTN/TTS) -------------
//  claves para The Things Stack
static const u1_t PROGMEM APPEUI[8]  = { 0x70,0xB3,0xD5,0x7E,0xD0,0x00,0x00,0x00 };
static const u1_t PROGMEM DEVEUI[8]  = { 0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01 };
static const u1_t PROGMEM APPKEY[16] = { 0x2B,0x7E,0x15,0x16,0x28,0xAE,0xD2,0xA6,0xAB,0xF7,0x15,0x88,0x09,0xCF,0x4F,0x3C };

void os_getArtEui (u1_t* buf) { memcpy_P(buf, APPEUI, 8);}
void os_getDevEui (u1_t* buf) { memcpy_P(buf, DEVEUI, 8);}
void os_getDevKey (u1_t* buf) { memcpy_P(buf, APPKEY, 16);}

static osjob_t sendjob;
const unsigned TX_INTERVAL = 60; // se podria usar en futuro para ver test de vida de bateria

// ------------- pin para mapear TTGO T-BEAM/ESP32 -------------
const lmic_pinmap lmic_pins = {
    .nss = 18,
    .rxtx = LMIC_UNUSED_PIN,
    .rst = 23,
    .dio = {26, 33, 32},
};

// ---------------- conf de led y boton ----------------
#define ALERT_BUTTON 38 // pin para el boton
#define LED_PIN 2       // led de confirmacion
#define PRESS_TIME_MS 3000 // tiempo de presion para confirmar alerta

// ---------------- conf gps ----------------
#define GPS_RX 34
#define GPS_TX 12
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

// ---------------- conf bateria ----------------
AXP20X_Class pmu;

bool alertSent = false;
bool joined = false;

// ------------- envio lorawan -------------
void do_send(osjob_t* j, String payload) {
    if (LMIC.opmode & OP_TXRXPEND) {
        Serial.println(F("OCUPADO, esperando..."));
    } else {
        uint8_t data[64];
        int len = payload.length();
        if (len > 51) len = 51;
        memcpy(data, payload.c_str(), len);
        LMIC_setTxData2(1, data, len, 0); // port 1, no confirmado
        Serial.println(F("Enviando paquete LoRaWAN..."));
        alertSent = true;
    }
}

void blinkLED(int times, int delayMs); 

void onEvent(ev_t ev) {
    if(ev == EV_JOINED) {
        Serial.println(F("¡Unido a LoRaWAN!"));
        joined = true;
        blinkLED(2, 300);
    }
    if(ev == EV_TXCOMPLETE) {
        Serial.println(F("Transmisión completa!"));
        blinkLED(3, 200);
    }
}

void blinkLED(int times, int delayMs){
    for(int i=0;i<times;i++){
        digitalWrite(LED_PIN,HIGH);
        delay(delayMs);
        digitalWrite(LED_PIN,LOW);
        delay(delayMs);
    }
}
// retornar voltaje
float readBattery(){
    if(!pmu.begin(Wire, AXP192_SLAVE_ADDRESS)) return -1;
    return pmu.getBattVoltage()/1000.0; 
}

String getGPSCoordinates(){
    unsigned long start = millis();
    while(millis()-start < 10000){ //  10s
        while(gpsSerial.available()){
            gps.encode(gpsSerial.read());
        }
        if(gps.location.isUpdated()){
            return String(gps.location.lat(),6) + "," + String(gps.location.lng(),6);
        }
    }
    return "0,0";
}

void setup() {
    Serial.begin(115200);
    delay(2000);
    pinMode(ALERT_BUTTON, INPUT_PULLUP);
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    Wire.begin();
    pmu.begin(Wire, AXP192_SLAVE_ADDRESS);

    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

    // ---------- LMIC INIT ----------
    os_init();
    LMIC_reset();
    LMIC_setDrTxpow(DR_SF7,14);
    LMIC_selectSubBand(1); // solo para US915 o AU915, comenta si EU868

    Serial.println("Esperando unión LoRaWAN...");
}

void loop() {
    static unsigned long buttonPressStart = 0;
    os_runloop_once();

    if(!joined) return; // Solo permite alerta si ya está unido

    // para detectar el boton presiona largo
    if(digitalRead(ALERT_BUTTON)==LOW){
        if(buttonPressStart==0) buttonPressStart = millis();
        else if(millis()-buttonPressStart > PRESS_TIME_MS){
            Serial.println("Alerta activada!");

            float battery = readBattery();
            String coords = getGPSCoordinates();
            Serial.println("GPS: "+coords+" Battery: "+String(battery,2));

            String payload = String("{\"GPS\":\"") + coords +
                             "\",\"Battery\":" + String(battery,2) + "}";

            do_send(&sendjob, payload);
            blinkLED(3,300);

            buttonPressStart=0;
            alertSent=false;
            Serial.println("Listo para nueva alerta");
        }
    }else{
        buttonPressStart=0;
    }

    delay(10);
}