#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

































































































































  

  
  
  #ifndef WIFI_SSID
  #define WIFI_SSID "YOUR_WIFI_SSID"
  #endif
  #ifndef WIFI_PASSWORD
  #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
  #endif

  const char* ssid = WIFI_SSID;
  const char* password = WIFI_PASSWORD;

  
  #define LED_BUILTIN_PIN 2      

  
  WebServer server(80);

  
  bool ledState = false;

  
  #define LOG_BUFFER_SIZE 20
  String logBuffer[LOG_BUFFER_SIZE];
  int logIndex = 0;
  int logCount = 0;

  
  void addLog(String message) {
    logBuffer[logIndex] = message;
    logIndex = (logIndex + 1) % LOG_BUFFER_SIZE;
    if (logCount < LOG_BUFFER_SIZE) {
      logCount++;
    }
    Serial.println(message); 
  }

  void connectToWiFi() {
    
    addLog("Connecting to WiFi network: " + String(ssid));
    
    WiFi.begin(ssid, password);
    
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      addLog("Connected to WiFi!");
      addLog("IP address: " + WiFi.localIP().toString());
      addLog("Signal strength (RSSI): " + String(WiFi.RSSI()) + " dBm");
    } else {
      Serial.println();
      addLog("Failed to connect to WiFi");
      addLog("Please check your credentials and try again");
    }
  }

  
  void handleLEDOn() {
    ledState = true;
    digitalWrite(LED_BUILTIN_PIN, HIGH);
    addLog("LED ON - via web request");
    
    
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "application/json", "{\"status\":\"LED ON\",\"state\":true}");
  }

  
  void handleLEDOff() {
    ledState = false;
    digitalWrite(LED_BUILTIN_PIN, LOW);
    addLog("LED OFF - via web request");
    
    
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "application/json", "{\"status\":\"LED OFF\",\"state\":false}");
  }

  
  void handleLEDStatus() {
    
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    
    String response = "{\"state\":" + String(ledState ? "true" : "false") + ",\"status\":\"" + String(ledState ? "LED ON" : "LED OFF") + "\"}";
    server.send(200, "application/json", response);
  }

  
  void handleLogs() {
    
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    
    String response = "{\"logs\":[";
    
    
    for (int i = 0; i < logCount; i++) {
      int index = (logIndex - logCount + i + LOG_BUFFER_SIZE) % LOG_BUFFER_SIZE;
      if (i > 0) response += ",";
      response += "\"" + logBuffer[index] + "\"";
    }
    
    response += "],\"count\":" + String(logCount) + "}";
    server.send(200, "application/json", response);
  }

  
  void handleCORS() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(200, "text/plain", "");
  }

  void setup() {
    
    Serial.begin(115200);
    addLog("Riu ESP32 starting up...");

    addLog("WiFi-enabled LED control ready");
    
    
    connectToWiFi();

    
    pinMode(LED_BUILTIN_PIN, OUTPUT);
    digitalWrite(LED_BUILTIN_PIN, LOW); 

    
    server.on("/led/on", HTTP_GET, handleLEDOn);
    server.on("/led/off", HTTP_GET, handleLEDOff);
    server.on("/led/status", HTTP_GET, handleLEDStatus);
    server.on("/logs", HTTP_GET, handleLogs);
    server.on("/led/on", HTTP_OPTIONS, handleCORS);
    server.on("/led/off", HTTP_OPTIONS, handleCORS);
    server.on("/led/status", HTTP_OPTIONS, handleCORS);
    server.on("/logs", HTTP_OPTIONS, handleCORS);

    
    server.begin();
    addLog("Web server started!");
    addLog("LED Control URLs:");
    addLog("LED ON:  http://" + WiFi.localIP().toString() + "/led/on");
    addLog("LED OFF: http://" + WiFi.localIP().toString() + "/led/off");
    addLog("Status:  http://" + WiFi.localIP().toString() + "/led/status");
    addLog("Logs:    http://" + WiFi.localIP().toString() + "/logs");
  }

  void loop() {
    
    if (WiFi.status() != WL_CONNECTED) {
      addLog("WiFi connection lost. Attempting to reconnect...");
      connectToWiFi();
    }
    
    
    server.handleClient();
    
    
    delay(10);
  }



