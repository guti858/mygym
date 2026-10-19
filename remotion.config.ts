import { Config } from '@remotion/cli/config';

// Usa el Chromium preinstalado si existe (entornos sin descarga de navegador).
if (process.env.REMOTION_CHROME) {
  Config.setBrowserExecutable(process.env.REMOTION_CHROME);
}
Config.setVideoImageFormat('jpeg');
Config.setChromiumOpenGlRenderer('angle');
