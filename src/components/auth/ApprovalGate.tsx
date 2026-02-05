import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FullPageLoader } from '@/components/ui/loading-spinner';

interface ApprovalGateProps {
  children: React.ReactNode;
  requireApproval?: boolean;
}

export function ApprovalGate({ children, requireApproval = true }: ApprovalGateProps) {
  const { user, profile, loading, signOut, isApproved } = useAuth();

  if (loading) {
    return <FullPageLoader text="Checking authentication..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!requireApproval) {
    return <>{children}</>;
  }

  if (profile?.status === 'rejected') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="data-card max-w-md text-center animate-m3-fade-in">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been rejected by an admin. Contact your team lead for more information.
          </p>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="data-card max-w-md text-center animate-m3-fade-in">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Pending Approval</h1>
          <p className="text-muted-foreground mb-6">
            Your account is waiting for admin approval. You'll be able to scout once approved.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Signed in as: <span className="font-medium text-foreground">{profile?.name || user.email}</span>
            </p>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
