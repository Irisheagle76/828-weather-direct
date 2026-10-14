export const API_ORIGIN='https://avlweather.com';
export function apiRequestUrl(value){
  if(typeof value!=='string' || !value.startsWith('/api/router?'))return null;
  return new URL(value,API_ORIGIN).href;
}
export function externalUrl(value){
  const url=new URL(value,API_ORIGIN);
  return ['https:','http:'].includes(url.protocol)?url.href:null;
}
