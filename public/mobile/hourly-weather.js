const conditions={
  0:['Clear','☀️'],1:['Mostly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Cloudy','☁️'],
  45:['Fog','🌫️'],48:['Freezing fog','🌫️'],51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy drizzle','🌧️'],
  56:['Freezing drizzle','🌧️'],57:['Freezing drizzle','🌧️'],61:['Light rain','🌦️'],63:['Rain','🌧️'],65:['Heavy rain','🌧️'],
  66:['Freezing rain','🌧️'],67:['Freezing rain','🌧️'],71:['Light snow','🌨️'],73:['Snow','🌨️'],75:['Heavy snow','❄️'],77:['Snow grains','🌨️'],
  80:['Rain showers','🌦️'],81:['Rain showers','🌧️'],82:['Heavy showers','🌧️'],85:['Snow showers','🌨️'],86:['Heavy snow showers','🌨️'],
  95:['Thunderstorms','⛈️'],96:['Storms with hail','⛈️'],99:['Strong storms','⛈️']
};
const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function hourlyWeather(hour={},daily=[]){
  const raw=hour.weatherCode ?? hour.weather_code;
  const code=raw==null?null:Number(raw);
  let condition=conditions[code];
  if(!condition){
    const cloud=hour.cloudCover ?? hour.cloud_cover;
    const fraction=Number.isFinite(cloud)?(cloud>1?cloud/100:cloud):null;
    condition=fraction==null?['Weather unavailable','—']:fraction>=.8?['Cloudy','☁️']:fraction>=.35?['Partly cloudy','⛅']:['Mostly clear','🌤️'];
  }
  let [label,icon]=condition;
  let night=hour.isDay===false || hour.isDay===0;
  if(Number.isFinite(hour.timestamp)){
    const solar=daily.find(day=>Number.isFinite(day.sunrise)&&Number.isFinite(day.sunset)&&dayKey(day.sunrise)===dayKey(hour.timestamp));
    if(solar)night=hour.timestamp<solar.sunrise || hour.timestamp>=solar.sunset;
  }
  if(night && [0,1,2].includes(code))icon=code===0?'🌙':'☁️';
  const rawProbability=hour.precipProbability;
  const probability=Number.isFinite(rawProbability)&&rawProbability>=0&&rawProbability<=100?Math.round(rawProbability<=1?rawProbability*100:rawProbability):null;
  return {label,icon,probability};
}
