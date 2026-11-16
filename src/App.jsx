import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import SubtitleUploader from './components/SubtitleUploader.jsx';
import AdBlockTestPage from './components/AdBlockTestPage.jsx';
import RankRestrictionWarning from './components/RankRestrictionWarning.jsx';
import UploadHistory from './components/history/UploadHistory.jsx';
import { logAppInit } from './utils/appLogger.js';
import { WEB_EMBED } from './config/environments.js';

function App() {
  // Initialize system logging on app start
  useEffect(() => {
    logAppInit();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <RankRestrictionWarning />
          <Routes>
            <Route path="/" element={<SubtitleUploader />} />
            <Route path="/history" element={<UploadHistory />} />
            {!WEB_EMBED && <Route path="/adblock" element={<AdBlockTestPage />} />}
          </Routes>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
