import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, Shield, User, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingUser {
  id: string;
  name: string;
  status: string;
  role: string;
  team_number: number | null;
  created_at: string;
}

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamRequests, setTeamRequests] = useState<any[]>([]);

  const loadUsers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setUsers(data.map(u => ({
        id: u.id,
        name: u.name,
        status: u.status,
        role: u.role,
        team_number: u.team_number,
        created_at: u.created_at,
      })));
    }
    
    setLoading(false);
  };

  const loadTeamRequests = async () => {
    const { data } = await (supabase as any)
      .from('team_change_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setTeamRequests(data);
  };

  const handleTeamRequest = async (requestId: string, userId: string, newTeam: number, action: 'approved' | 'rejected') => {
    if (action === 'approved') {
      await supabase.from('profiles').update({ team_number: newTeam }).eq('id', userId);
    }
    await (supabase as any).from('team_change_requests').update({ status: action, reviewed_by: user!.id, reviewed_at: new Date().toISOString() }).eq('id', requestId);
    toast({ title: 'Done', description: `Team change request ${action}.` });

    // Send email notification (fire-and-forget)
    supabase.functions.invoke('notify-user', {
      body: {
        type: action === 'approved' ? 'team_change_approved' : 'team_change_rejected',
        user_id: userId,
        details: { new_team: newTeam },
      },
    }).then(({ error }) => {
      if (error) console.error('Failed to send notification:', error);
    });

    loadTeamRequests();
    loadUsers();
  };

  useEffect(() => {
    if (user && isAdmin) {
      loadUsers();
      loadTeamRequests();
    }
  }, [user, isAdmin]);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/scout" replace />;
  }

  const updateUserStatus = async (userId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update user status.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `User ${status === 'approved' ? 'approved' : 'rejected'}.`,
      });
      loadUsers();
    }
  };

  const promoteToAdmin = async (userId: string) => {
    // Insert into user_roles (the authoritative roles table)
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: 'admin' as const });

    if (roleError) {
      toast({
        title: 'Error',
        description: 'Failed to promote user.',
        variant: 'destructive',
      });
      return;
    }

    // Also update profiles.role for display purposes
    await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId);

    toast({
      title: 'Success',
      description: 'User promoted to admin.',
    });
    loadUsers();
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved');

  return (
    <AppLayout>
      <PageHeader
        title="Admin Panel"
        description="Manage users and approvals"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Team Change Requests */}
          {teamRequests.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Team Change Requests ({teamRequests.length})
              </h2>
              <div className="space-y-3">
                {teamRequests.map((req: any) => {
                  const reqUser = users.find(u => u.id === req.user_id);
                  return (
                    <div key={req.id} className="data-card flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{reqUser?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          #{req.current_team_number} → #{req.requested_team_number}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => handleTeamRequest(req.id, req.user_id, req.requested_team_number, 'rejected')} className="text-destructive hover:bg-destructive/10">
                          <X className="w-4 h-4 mr-1" /> Deny
                        </Button>
                        <Button size="sm" onClick={() => handleTeamRequest(req.id, req.user_id, req.requested_team_number, 'approved')}>
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending Users */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-warning" />
              Pending Approval ({pendingUsers.length})
            </h2>
            
            {pendingUsers.length === 0 ? (
              <div className="data-card text-center py-8 text-muted-foreground">
                No pending users
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div key={pendingUser.id} className="data-card flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{pendingUser.name}</p>
                        {pendingUser.team_number && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                            #{pendingUser.team_number}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(pendingUser.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUserStatus(pendingUser.id, 'rejected')}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateUserStatus(pendingUser.id, 'approved')}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Users */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Approved Users ({approvedUsers.length})
            </h2>
            
            {approvedUsers.length === 0 ? (
              <div className="data-card text-center py-8 text-muted-foreground">
                No approved users
              </div>
            ) : (
              <div className="space-y-3">
                {approvedUsers.map((approvedUser) => (
                  <div key={approvedUser.id} className="data-card flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      approvedUser.role === 'admin' ? "bg-primary/20" : "bg-muted"
                    )}>
                      {approvedUser.role === 'admin' ? (
                        <Shield className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{approvedUser.name}</p>
                        {approvedUser.team_number && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                            #{approvedUser.team_number}
                          </span>
                        )}
                        {approvedUser.role === 'admin' && (
                          <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-semibold">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">
                        {approvedUser.role}
                      </p>
                    </div>
                    {approvedUser.role !== 'admin' && approvedUser.id !== user.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => promoteToAdmin(approvedUser.id)}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        Promote
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
