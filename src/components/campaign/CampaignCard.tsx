// Campaign Card Component
// Mobile-first card for displaying campaign in list view

import { memo } from 'react';
import { Folder, Calendar, FileText, ChevronRight, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Campaign } from '@/lib/chronicleSync/multiSession/types';
import { format, formatDistanceToNow } from 'date-fns';

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (id: string) => void;
  onEdit: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
}

export const CampaignCard = memo(function CampaignCard({ 
  campaign, 
  onSelect, 
  onEdit, 
  onDelete 
}: CampaignCardProps) {
  const lastActivity = campaign.lastSessionDate 
    ? formatDistanceToNow(new Date(campaign.lastSessionDate), { addSuffix: true })
    : 'No sessions yet';

  return (
    <Card 
      className="group border-border/50 bg-card/60 backdrop-blur-sm hover:bg-card/80 transition-all cursor-pointer active:scale-[0.98]"
      onClick={() => onSelect(campaign.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
            <Folder className="w-5 h-5" />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{campaign.name}</h3>
                {campaign.dmName && (
                  <p className="text-xs text-muted-foreground truncate">DM: {campaign.dmName}</p>
                )}
              </div>
              
              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(campaign); }}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(campaign.id); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {campaign.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {campaign.description}
              </p>
            )}
            
            {/* Stats Row */}
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                {campaign.sessionCount} {campaign.sessionCount === 1 ? 'session' : 'sessions'}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {lastActivity}
              </span>
            </div>
            
            {/* Tags */}
            {campaign.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {campaign.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                    {tag}
                  </Badge>
                ))}
                {campaign.tags.length > 3 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{campaign.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {/* Chevron */}
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 self-center opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
});
