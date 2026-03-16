import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import FeatureGate from './components/FeatureGate';
import ProtectedRoute from './components/ProtectedRoute';
import { FeatureFlagsProvider } from './hooks/useFeatureFlags';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TeamDirectoryPage from './pages/TeamDirectoryPage';
import TeamMemberDetailPage from './pages/TeamMemberDetailPage';
import MyTemplatesPage from './pages/MyTemplatesPage';
import TemplateFulfillmentPage from './pages/TemplateFulfillmentPage';
import TemplateLibraryPage from './pages/TemplateLibraryPage';
import TemplateDetailPage from './pages/TemplateDetailPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import TemplateAssignPage from './pages/TemplateAssignPage';
import TemplatesFeatureUnavailablePage from './pages/TemplatesFeatureUnavailablePage';
import {
  MyDocumentsPage,
  MyHoursPage,
  MyMedicalPage,
  MyNotificationsPage,
  MyProfilePage,
  MyQualificationsPage,
  NotFoundPage,
  ReviewDetailPage,
  ReviewQueuePage,
  StandardDetailPage,
  StandardsLibraryPage,
  TeamDocumentsPage,
  TeamHoursPage,
  TeamMedicalPage,
  TeamQualificationsPage,
  UnauthorizedPage,
} from './pages/RoutePlaceholderPages';

function LegacyEmployeeDetailRedirect() {
  const { id } = useParams<{ id: string }>();

  return <Navigate to={id ? `/team/${id}` : '/team'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <FeatureFlagsProvider>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me"
          element={
            <ProtectedRoute>
              <MyProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/qualifications"
          element={
            <ProtectedRoute>
              <MyQualificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/medical"
          element={
            <ProtectedRoute>
              <MyMedicalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/documents"
          element={
            <ProtectedRoute>
              <MyDocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/hours"
          element={
            <ProtectedRoute>
              <MyHoursPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/notifications"
          element={
            <ProtectedRoute>
              <MyNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/templates"
          element={
            <ProtectedRoute>
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <MyTemplatesPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/templates/:assignmentId"
          element={
            <ProtectedRoute>
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <TemplateFulfillmentPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <TemplateLibraryPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id/edit"
          element={
            <ProtectedRoute minRole="manager">
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <TemplateEditorPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id/assign"
          element={
            <ProtectedRoute minRole="supervisor">
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <TemplateAssignPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates/:id"
          element={
            <ProtectedRoute>
              <FeatureGate flag="compliance.templates" fallback={<TemplatesFeatureUnavailablePage />}>
                <TemplateDetailPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route
          path="/team"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamDirectoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team/:id"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamMemberDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team/:id/qualifications"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamQualificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team/:id/medical"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamMedicalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team/:id/documents"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamDocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team/:id/hours"
          element={
            <ProtectedRoute minRole="supervisor">
              <TeamHoursPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/standards"
          element={
            <ProtectedRoute>
              <StandardsLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/standards/:id"
          element={
            <ProtectedRoute>
              <StandardDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviews"
          element={
            <ProtectedRoute minRole="manager">
              <ReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reviews/:id"
          element={
            <ProtectedRoute minRole="manager">
              <ReviewDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/unauthorized"
          element={
            <ProtectedRoute>
              <UnauthorizedPage />
            </ProtectedRoute>
          }
        />
        <Route path="/employees" element={<Navigate to="/team" replace />} />
        <Route path="/employees/:id" element={<LegacyEmployeeDetailRedirect />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </FeatureFlagsProvider>
    </AuthProvider>
  );
}

export default App;
