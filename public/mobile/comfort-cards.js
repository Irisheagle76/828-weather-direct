export function renderComfortCard(bucket,{best=false,formatTime,escapeHtml}){
  const range=(min,max)=>min==null?'—':min===max?String(min):min+'–'+max;
  const score=range(bucket.min,bucket.max);
  const temperature=range(bucket.tempMin,bucket.tempMax);
  const quality=bucket.min==null?'Guidance unavailable':bucket.min>=90?'Excellent comfort':bucket.min>=80?'Comfortable':bucket.min>=70?'Fair comfort':bucket.min>=50?'Mixed comfort':'Limited comfort';
  const emoji=({Morning:'🌅','Early afternoon':'☀️',Evening:'🌇','Late night':'🌙'})[bucket.name] || '🌤️';
  return '<section class="comfort-bucket comfort-period-'+bucket.name.toLowerCase().replaceAll(' ','-')+(best?' is-best':'')+'">'+
    '<header class="bucket-heading"><span class="comfort-period-emoji" aria-hidden="true">'+emoji+'</span><div><strong>'+escapeHtml(bucket.name)+'</strong><small>'+escapeHtml(bucket.label)+(bucket.partial?' · remaining hours':'')+'</small></div>'+(best?'<span class="bucket-best">★ Best window</span>':'')+'</header>'+
    '<div class="bucket-metrics"><div class="bucket-metric bucket-air"><span class="bucket-metric-label">Temperature</span><strong class="bucket-metric-value">'+temperature+(bucket.tempMin==null?'':'<span class="bucket-unit">°F</span>')+'</strong><small>Forecast air temperature</small></div>'+
    '<div class="bucket-metric bucket-comfort"><span class="bucket-metric-label">FEELSCORE</span><strong class="bucket-metric-value">'+score+'<span class="bucket-unit">/100</span></strong><small>Outdoor comfort index</small></div></div>'+
    '<p class="bucket-verdict">'+quality+'<span>Higher score = more comfortable</span></p>'+
    '<details class="bucket-detail"><summary>Explore hour by hour</summary><div class="bucket-hourly"><div class="bucket-hourly-heading"><span>Time</span><span>Temp °F</span><span>FEELSCORE</span></div>'+
    bucket.points.map(point=>'<div><span>'+escapeHtml(formatTime(point.hour.timestamp))+'</span><strong>'+(Number.isFinite(point.hour.temperatureF)?Math.round(point.hour.temperatureF)+'°F':'—')+'</strong><span>'+Math.round(point.score*10)+'/100</span></div>').join('')+
    '</div>'+(bucket.min==null?'':'<p>'+escapeHtml(bucket.takeaway)+'</p>')+'</details></section>';
}
