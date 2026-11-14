export interface SampleDataset {
  id: string;
  name: string;
  badgeLabel: string;
  description: string;
  defaultAudience: "ward_officer" | "housing_society" | "school";
  data: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "delhi-ward",
    name: "[Sample] Delhi Ward Sensor Network",
    badgeLabel: "Sample: Ward Officers",
    description: "Multi-ward municipal data covering high-density traffic nodes, road dust corridors, and residential sectors.",
    defaultAudience: "ward_officer",
    data: `Station,Timestamp,PM2.5 (ug/m3),PM10 (ug/m3),NO2 (ug/m3),AQI
Anand Vihar,2026-11-14 07:00,312.4,455.0,98.2,435
Anand Vihar,2026-11-14 12:00,245.0,380.0,76.5,385
Punjabi Bagh,2026-11-14 07:00,210.5,335.0,68.4,360
Punjabi Bagh,2026-11-14 12:00,185.0,290.0,55.0,345
Connaught Place,2026-11-14 07:00,135.0,210.0,48.0,290
Connaught Place,2026-11-14 12:00,110.0,175.0,42.0,260
RK Puram,2026-11-14 07:00,165.0,260.0,62.0,330
Dwarka Sector 8,2026-11-14 07:00,140.0,225.0,45.0,300
Lodhi Road,2026-11-14 07:00,68.0,115.0,28.0,127
Lodhi Road,2026-11-14 12:00,55.0,95.0,22.0,92`,
  },
  {
    id: "bengaluru-society",
    name: "[Sample] Bengaluru Housing Society Baseline",
    badgeLabel: "Sample: Housing Society",
    description: "Micro-climate telemetry across estate gates, gardens, clubhouse, and backup diesel generator yards.",
    defaultAudience: "housing_society",
    data: `Location,Time,PM2.5 (ug/m3),PM10 (ug/m3),CO (mg/m3),AQI
Wing A Central Park,06:30,35.0,62.0,0.8,58
Wing A Central Park,10:30,48.0,85.0,1.2,80
Clubhouse & Pool,06:30,32.0,58.0,0.7,53
Gate 1 Main Road Exit,08:30,88.0,165.0,3.4,195
Wing C Generator Yard,09:00,185.0,290.0,8.2,345
Wing C Generator Yard,11:00,95.0,170.0,2.1,205
Basement Parking B2,09:00,72.0,130.0,4.8,160
Wing E Children Play Area,07:00,38.0,66.0,0.9,63
Wing E Children Play Area,17:30,64.0,110.0,1.5,113`,
  },
  {
    id: "mumbai-schools",
    name: "[Sample] Mumbai School District Anomaly Data",
    badgeLabel: "Sample: School District",
    description: "School district telemetry during morning assembly and transit, containing real sensor telemetry anomalies (stuck sensor, missing field, impossible negative value).",
    defaultAudience: "school",
    data: `School Station,Session Hour,PM2.5,PM10,AQI
St Xavier High School,07:00,110.0,185.0,270
St Xavier High School,08:30,175.0,280.0,340
St Xavier High School,10:00,140.0,230.0,310
Bandra Public Academy,07:00,62.0,105.0,107
Bandra Public Academy,08:30,62.0,105.0,107
Bandra Public Academy,10:00,62.0,105.0,107
Chembur Primary Campus,07:00,210.0,340.0,365
Chembur Primary Campus,08:30,260.0,410.0,415
Andheri Model School,07:00,-15.0,140.0,120
Powai Green School,07:00,45.0,,75
Powai Green School,08:30,58.0,92.0,97`,
  },
];
