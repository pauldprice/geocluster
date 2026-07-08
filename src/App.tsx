import { useEffect, useRef, useState } from 'react';
import { controller } from './map/controller';
import { AlertBanner } from './components/AlertBanner';
import { DownloadModal } from './components/DownloadModal';
import { Footer } from './components/Footer';
import { Toolbar } from './components/Toolbar';
import { ZonePanel } from './components/ZonePanel';

export function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    if (mapRef.current) controller.init(mapRef.current);
  }, []);

  return (
    <>
      <header>
        <h1>Neighborhood Cluster Lasso</h1>
        <Toolbar onOpenDownload={() => setShowDownload(true)} />
      </header>
      <div id="map" ref={mapRef} />
      <AlertBanner />
      <ZonePanel />
      {showDownload && <DownloadModal onClose={() => setShowDownload(false)} />}
      <Footer />
    </>
  );
}
