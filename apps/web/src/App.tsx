import { Navigate, Route, Routes } from "react-router-dom";
import { GlobalStatsPage } from "./pages/GlobalStatsPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { UploadPage } from "./pages/UploadPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/profile/:accountId" element={<ProfilePage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/stats" element={<GlobalStatsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
