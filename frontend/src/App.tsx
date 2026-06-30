import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import AddAssetPage from "./pages/AddAssetPage";
import EditAssetPage from "./pages/EditAssetPage";
import AllocationsPage from "./pages/AllocationsPage";
import ProfilePage from "./pages/ProfilePage";
import CreateUserPage from "./pages/CreateUserPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/assets/add" element={<AddAssetPage />} />
        <Route path="/assets/:id/edit" element={<EditAssetPage />} />
        <Route path="/allocations" element={<AllocationsPage />} />
        <Route path="/users" element={<CreateUserPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
