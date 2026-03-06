import React from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import DocViewer from './components/DocViewer';
import ErrorPage from './components/ErrorPage';

const DocumentationPage = () => {
  const { slug } = useParams();
  return <DocViewer slug={slug} />;
};

const App = () => {
  return (
    <Routes>
      <Route path="/p/:slug" element={<DocumentationPage />} />
      <Route path="/" element={<ErrorPage error={{ message: 'Please provide a valid documentation URL' }} />} />
      <Route path="*" element={<ErrorPage error={{ message: 'Documentation not found' }} />} />
    </Routes>
  );
};

export default App;
