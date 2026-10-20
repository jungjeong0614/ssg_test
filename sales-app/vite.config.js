import {defineConfig,loadEnv} from 'vite';
import {fileURLToPath} from 'node:url';
import {weatherHandler} from './server/weather.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export default defineConfig(()=>{
  const env=loadEnv('development',root,'OPENWEATHER_');
  if(!process.env.OPENWEATHER_API_KEY&&env.OPENWEATHER_API_KEY)process.env.OPENWEATHER_API_KEY=env.OPENWEATHER_API_KEY;
  const register=server=>{server.middlewares.use((req,res,next)=>{
    if(req.url?.split('?')[0]==='/api/weather')return weatherHandler(req,res);
    if(req.url?.startsWith('/api/')){res.statusCode=404;res.end('API not found');return;}next();
  });};
  return {plugins:[{name:'server-weather-only',configureServer:register,configurePreviewServer:register}]};
});
