import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isElectronRuntime =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');
const isFileProtocol =
  typeof window !== 'undefined' && window.location.protocol === 'file:';

if (!isElectronRuntime && !isFileProtocol) {
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
