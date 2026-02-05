import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Share2 } from 'lucide-react';

export default function TeamCollaboration() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-600" />
            Team Collaboration
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Manage team members, share campaigns, and collaborate</p>
        </div>

        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Team Members
            </CardTitle>
            <CardDescription>0 team members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No team members yet</p>
              <p className="text-xs">Invite team members to collaborate on campaigns</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-purple-600" />
              Shared Campaigns
            </CardTitle>
            <CardDescription>0 shared campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Share2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No shared campaigns</p>
              <p className="text-xs">Share campaigns with your team to collaborate</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
