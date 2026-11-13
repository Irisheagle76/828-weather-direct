const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit"
});
export function ashevilleDate(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({type, value}) => [type, value]));
  return [parts.year, parts.month, parts.day].join("-");
}
export function withTodayBottomLine(forecast, date, saved) {
  if (typeof saved?.text !== "string") return forecast;
  const days = forecast?.days || {};
  return { ...forecast, days: { ...days, [date]: { ...days[date], date, bottomLine: saved.text } } };
}
