import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AssetsPage from "./pages/AssetsPage";
import AddAssetPage from "./pages/AddAssetPage";
import EditAssetPage from "./pages/EditAssetPage";
import AllocationsPage from "./pages/AllocationsPage";
import ProfilePage from "./pages/ProfilePage";
import CreateUserPage from "./pages/CreateUserPage";
import LicensePage from "./pages/LicensePage";
import MaintainencePage from "./pages/MaintainencePage";
import EmployeePage from "./pages/EmployeePage";
import QRCodePage from "./pages/QRCodePage";
import QRCodeBoundary from "./components/QRCodeBoundary";
import AuthGuard from "./components/AuthGuard";

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
        <Route path="/users" element={<AuthGuard adminOnly><CreateUserPage /></AuthGuard>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/licenses" element={<LicensePage />} />
        <Route path="/maintainence" element={<MaintainencePage />} />
        <Route path="/employees" element={<AuthGuard adminOnly><EmployeePage /></AuthGuard>} />
        <Route path="/qr-codes" element={<QRCodeBoundary><QRCodePage /></QRCodeBoundary>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
