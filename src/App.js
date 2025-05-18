import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import AdminDangerMap from './pages/AdminDangerMap';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AdminPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/danger-map" element={<AdminDangerMap />} />
      </Routes>
    </Router>
  );
}

export default App;
