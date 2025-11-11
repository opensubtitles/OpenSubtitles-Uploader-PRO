import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import SubtitleUploader from './components/SubtitleUploader.jsx';
import AdBlockTestPage from './components/AdBlockTestPage.jsx';
import RankRestrictionWarning from './components/RankRestrictionWarning.jsx';
import { logAppInit } from './utils/appLogger.js';

function App() {
  // Initialize system logging on app start
  useEffect(() => {
    logAppInit();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <RankRestrictionWarning />
        <Routes>
          <Route path="/" element={<SubtitleUploader />} />
          <Route path="/adblock" element={<AdBlockTestPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
