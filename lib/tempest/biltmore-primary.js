export const BILTMORE_STATION_ID = '237451';
const fresh = (obs, now) => Number.isFinite(obs?.timestamp) && now-obs.timestamp >= -60000 && now-obs.timestamp <= 10*60000;
export function biltmorePrimary(current, measured, now = Date.now()) {
 const base=fresh(current,now)?current:null;
 const raw=fresh(measured,now)?measured:null;
 if(!base&&!raw)return null;
 const result={...(base||{})};
 if(raw){
  if(Number.isFinite(raw.sea_level_pressure))result.pressure=raw.sea_level_pressure;
  for(const key of ['air_temperature','relative_humidity','dew_point','wind_avg','wind_gust','wind_direction','station_pressure','sea_level_pressure','precipRate','rainRateObservedAt','precipAccum','precipAccumLocalDay','solar_radiation','uv','timestamp']){
   if(Number.isFinite(raw[key]))result[key]=raw[key];
  }
 }
 return {...result,stationId:BILTMORE_STATION_ID,name:'Biltmore Village Tempest'};
}
