// Campaign Manager Screen
// Mobile-first interface for managing campaigns and sessions

import { useState, useCallback } from 'react';
import { 
  ArrowLeft, Folder, Plus, Search, FolderOpen, 
  BarChart3, FileText, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BackgroundWrapper } from '@/components/ui/BackgroundWrapper';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useGMGuides } from '@/hooks/use-gm-guides';
import { useGuidePresets } from '@/hooks/use-guide-presets';
import { Campaign, CampaignSession } from '@/lib/chronicleSync/multiSession/types';
import { CampaignCard } from './CampaignCard';
import { CreateCampaignSheet } from './CreateCampaignSheet';
import { CampaignDetailView } from './CampaignDetailView';
import combatBackground from '@/assets/combat-background.jpg';

interface CampaignManagerScreenProps {
  onBack: () => void;
}

export function CampaignManagerScreen({ onBack }: CampaignManagerScreenProps) {
  const {
    campaigns,
    loading,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    getCampaign,
    getCampaignSessions,
    getCampaignStats,
    importSessions,
    deleteSession,
  } = useCampaigns();

  const { guides } = useGMGuides();
  const { presets: guidePresets, createPreset, deletePreset: deleteGuidePreset } = useGuidePresets();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [deleteCampaignId, setDeleteCampaignId] = useState<string | null>(null);

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.dmName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected campaign data
  const selectedCampaign = selectedCampaignId ? getCampaign(selectedCampaignId) : null;
  const selectedSessions = selectedCampaignId ? getCampaignSessions(selectedCampaignId) : [];
  const selectedStats = selectedCampaignId ? getCampaignStats(selectedCampaignId) : null;

  // Handlers
  const handleCreateOrUpdate = useCallback((data: {
    name: string;
    description?: string;
    dmName?: string;
    setting?: string;
    tags: string[];
  }) => {
    if (editingCampaign) {
      updateCampaign(editingCampaign.id, data);
    } else {
      createCampaign(data);
    }
    setEditingCampaign(null);
  }, [editingCampaign, createCampaign, updateCampaign]);

  const handleEdit = useCallback((campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowCreateSheet(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteCampaignId) {
      deleteCampaign(deleteCampaignId);
      setDeleteCampaignId(null);
      if (selectedCampaignId === deleteCampaignId) {
        setSelectedCampaignId(null);
      }
    }
  }, [deleteCampaignId, deleteCampaign, selectedCampaignId]);

  const handleImportSessions = useCallback((
    sessions: Array<Omit<CampaignSession, 'id' | 'campaignId' | 'createdAt'>>
  ) => {
    if (selectedCampaignId) {
      importSessions(selectedCampaignId, sessions);
    }
  }, [selectedCampaignId, importSessions]);

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (selectedCampaignId) {
      deleteSession(selectedCampaignId, sessionId);
    }
  }, [selectedCampaignId, deleteSession]);

  const handleUpdateGuideIds = useCallback((guideIds: string[]) => {
    if (selectedCampaignId) {
      updateCampaign(selectedCampaignId, { gmGuideIds: guideIds });
    }
  }, [selectedCampaignId, updateCampaign]);

  // If viewing a campaign detail
  if (selectedCampaign && selectedStats) {
    return (
      <BackgroundWrapper 
        imagePath={combatBackground} 
        overlayOpacity={80} 
        tintColor="cyan" 
        tintOpacity={15}
      >
        <CampaignDetailView
          campaign={selectedCampaign}
          sessions={selectedSessions}
          stats={selectedStats}
          guides={guides}
          guidePresets={guidePresets}
          onBack={() => setSelectedCampaignId(null)}
          onImportSessions={handleImportSessions}
          onDeleteSession={handleDeleteSession}
          onUpdateGuideIds={handleUpdateGuideIds}
          onCreatePreset={createPreset}
          onDeletePreset={deleteGuidePreset}
        />
      </BackgroundWrapper>
    );
  }

  return (
    <BackgroundWrapper 
      imagePath={combatBackground} 
      overlayOpacity={80} 
      tintColor="cyan" 
      tintOpacity={15}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-background/95 via-background/90 to-transparent backdrop-blur-md border-b border-primary/20 px-4 py-3">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-cyan-400" />
            <h1 className="font-cinzel font-bold text-lg uppercase tracking-wider text-cyan-400">
              Campaigns
            </h1>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              setEditingCampaign(null);
              setShowCreateSheet(true);
            }}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-muted/30 border-border/50"
          />
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Folder className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create your first campaign to organize your session logs and track cumulative stats.
            </p>
            <Button 
              onClick={() => setShowCreateSheet(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </Button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold mb-2">No Results</h3>
            <p className="text-sm text-muted-foreground">
              No campaigns match "{searchQuery}"
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3 pb-4">
              {filteredCampaigns.map(campaign => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSelect={setSelectedCampaignId}
                  onEdit={handleEdit}
                  onDelete={setDeleteCampaignId}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Quick Stats */}
        {campaigns.length > 0 && (
          <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto">
            <div className="flex justify-center gap-4 p-3 rounded-xl bg-background/80 backdrop-blur-lg border border-border/50">
              <div className="text-center">
                <p className="text-lg font-bold text-cyan-400">{campaigns.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Campaigns</p>
              </div>
              <div className="w-px bg-border/50" />
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">
                  {campaigns.reduce((sum, c) => sum + c.sessionCount, 0)}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sessions</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Sheet */}
      <CreateCampaignSheet
        open={showCreateSheet}
        onOpenChange={(open) => {
          setShowCreateSheet(open);
          if (!open) setEditingCampaign(null);
        }}
        editingCampaign={editingCampaign}
        onSave={handleCreateOrUpdate}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCampaignId} onOpenChange={() => setDeleteCampaignId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this campaign and all its sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BackgroundWrapper>
  );
}
