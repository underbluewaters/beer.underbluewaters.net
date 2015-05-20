#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 2
#define FERMENTER_RELAY 8
#define KEEZER_RELAY 9
#define INDICATOR 13

int relayState = 0;
int oldRelayState = 0;
int deviceCount = 0;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup(void) {

  delay(10000); // seems to help with linux reboot
  
  Serial1.begin(115200);
  while (!Serial1) {
    ;
  }
  
  sensors.begin();
  deviceCount = sensors.getDeviceCount();
  Serial1.print("Device count: ");
  Serial1.println(deviceCount);
  
  pinMode(FERMENTER_RELAY, OUTPUT);
  pinMode(KEEZER_RELAY, OUTPUT);
  
  // Make sure those relays start off
  digitalWrite(FERMENTER_RELAY, LOW);
  digitalWrite(KEEZER_RELAY, LOW);
}


void loop(void) {

  // Process relay commands
  // Wait for two bytes, a command-start byte 
  // and then the actual command
  long start_time = millis();
  while (Serial1.available() < 2){
    Serial1.println(millis() - start_time);
    if( (millis() - start_time) > 300 ) {
      break;
    }
  }
  
  if (Serial1.available() >= 2) {
    if (Serial1.read() == 'c') {
      oldRelayState = relayState
      relayState = Serial1.read();
      Serial1.println("received command");
      Serial1.println(relayState); 
      if (relayState == 99) {
        Serial1.println("last command corrupt (99). ignoring");
        relayState = oldRelayState
      }
    } // Skip corrupt messages without commandStart
  }
  if(relayState & 0x01){
    Serial1.println("Turning fermenter relay ON");
  }else{
    Serial1.println("Turning fermenter relay OFF");
  }
  if(relayState & 0x10){
    Serial1.println("Turning keezer relay ON");
  }else{
    Serial1.println("Turning keezer relay OFF");
  }
  digitalWrite(FERMENTER_RELAY, relayState & 0x01);
  digitalWrite(KEEZER_RELAY, relayState & 0x10);

  // Get and send off temperature readings
  sensors.requestTemperatures();
  delay(1000); // delay when using parasitic power

  Serial1.print('['); // start printing json array
  for (int i = 0; i < deviceCount ; i++) { 
    Serial1.print(sensors.getTempFByIndex(i));
    if (i != deviceCount - 1){
      Serial1.print(','); // no trailing commas!
    }
  }
  Serial1.println(']'); // end json array
  delay(500);
}

