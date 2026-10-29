import {payload} from '../../biltmore/current.js';
export default async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
 try{const data=await payload();res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=30');return res.status(200).json(data);}catch{return res.status(503).json({error:'Observations unavailable'});}
}
