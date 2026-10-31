import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import Layout from './components/Layout';
import Home from './pages/Home';
import MKs from './pages/MKs';
import MKPage from './pages/MKPage';
import Parties from './pages/Parties';
import PartyPage from './pages/PartyPage';
import MapPage from './pages/MapPage';
import Represent from './pages/Represent';
import Votes from './pages/Votes';
import About from './pages/About';
import Topics from './pages/Topics';
import Record from './pages/Record';
import Who from './pages/Who';

// Public, read-only site: no sign-in required; all data is static JSON under /public/data.
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/who" element={<Who />} />
            <Route path="/mks" element={<MKs />} />
            <Route path="/mk/:id" element={<MKPage />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/voters" element={<Parties mode="voters" />} />
            <Route path="/record" element={<Record />} />
            <Route path="/party/:id" element={<PartyPage />} />
            <Route path="/represent" element={<Represent />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/votes" element={<Votes />} />
            <Route path="/clusters" element={<Topics />} />
            <Route path="/topics" element={<Topics />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<PageNotFound />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  )
}

export default App
