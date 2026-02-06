import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Pencil,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Wand2,
  FileJson,
  Check,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAbilityCustomization } from '@/hooks/use-ability-customization';
import { getAbilityById } from '@/lib/abilities';
import { AbilityCustomizationState, HomebrewAbility } from '@/lib/abilityCustomization/types';

interface CustomizationsPanelProps {
  onClose?: () => void;
}

export function CustomizationsPanel({ onClose }: CustomizationsPanelProps) {
  const customization = useAbilityCustomization();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Get all overrides with their base ability names
  const overridesList = useMemo(() => {
    return Object.entries(customization.state.overrides).map(([abilityId, override]) => {
      const baseAbility = getAbilityById(abilityId);
      return {
        abilityId,
        override,
        baseName: baseAbility?.name || 'Unknown Ability',
        customName: override.customName,
        tree: baseAbility?.tree || 'hunter',
        icon: override.customIcon || baseAbility?.icon || 'Sparkles',
      };
    });
  }, [customization.state.overrides]);

  // Get all homebrew abilities
  const homebrewList = customization.state.homebrewAbilities;

  const totalCount = overridesList.length + homebrewList.length;
  const hasCustomizations = totalCount > 0;

  // Get icon component dynamically
  const getIconComponent = (iconName: string) => {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;
    return icons[iconName] || LucideIcons.Sparkles;
  };

  // Export customizations as JSON
  const handleExport = async () => {
    try {
      const exportData = JSON.stringify(customization.state, null, 2);
      await navigator.clipboard.writeText(exportData);
      setCopiedExport(true);
      toast.success('Customizations exported to clipboard!', {
        description: `${totalCount} customization${totalCount !== 1 ? 's' : ''} copied as JSON`,
      });
      setTimeout(() => setCopiedExport(false), 2000);
    } catch (err) {
      toast.error('Failed to export customizations');
    }
  };

  // Download as file
  const handleDownload = () => {
    try {
      const exportData = JSON.stringify(customization.state, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ability-customizations-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Customizations downloaded!');
    } catch (err) {
      toast.error('Failed to download customizations');
    }
  };

  // Import customizations from JSON
  const handleImport = () => {
    setImportError(null);
    try {
      const parsed = JSON.parse(importText) as AbilityCustomizationState;
      
      // Validate structure
      if (typeof parsed.version !== 'number') {
        throw new Error('Invalid format: missing version');
      }
      if (typeof parsed.overrides !== 'object') {
        throw new Error('Invalid format: missing overrides');
      }
      if (!Array.isArray(parsed.homebrewAbilities)) {
        throw new Error('Invalid format: missing homebrewAbilities array');
      }

      // Count what we're importing
      const overrideCount = Object.keys(parsed.overrides).length;
      const homebrewCount = parsed.homebrewAbilities.length;

      // Merge with existing (imported data takes precedence)
      Object.entries(parsed.overrides).forEach(([abilityId, override]) => {
        customization.setOverride({ ...override, abilityId });
      });
      
      parsed.homebrewAbilities.forEach((homebrew) => {
        // Check if homebrew with same ID exists, update or add
        const existing = customization.getHomebrew(homebrew.id);
        if (existing) {
          customization.updateHomebrew(homebrew.id, homebrew);
        } else {
          // Add as new (will generate new ID)
          customization.addHomebrew({
            name: homebrew.name,
            tree: homebrew.tree,
            icon: homebrew.icon,
            type: homebrew.type,
            actionType: homebrew.actionType,
            usageType: homebrew.usageType,
            tierEffects: homebrew.tierEffects,
            dice: homebrew.dice,
            cooldownMinutes: homebrew.cooldownMinutes,
            minLevel: homebrew.minLevel,
            notes: homebrew.notes,
          });
        }
      });

      toast.success('Customizations imported!', {
        description: `${overrideCount} override${overrideCount !== 1 ? 's' : ''}, ${homebrewCount} homebrew${homebrewCount !== 1 ? 's' : ''}`,
      });
      setShowImportDialog(false);
      setImportText('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  // Reset all customizations
  const handleResetAll = () => {
    customization.resetAll();
    setShowResetDialog(false);
    toast.success('All customizations reset!');
  };

  // Remove single override
  const handleRemoveOverride = (abilityId: string) => {
    customization.removeOverride(abilityId);
    toast.success('Override removed');
  };

  // Remove single homebrew
  const handleRemoveHomebrew = (id: string, name: string) => {
    customization.removeHomebrew(id);
    toast.success(`"${name}" removed`);
  };

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-cinzel font-semibold text-base flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            Ability Customizations
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {totalCount} customization{totalCount !== 1 ? 's' : ''} saved
          </p>
        </div>
        
        {hasCustomizations && (
          <Badge variant="secondary" className="text-xs">
            {overridesList.length} modified • {homebrewList.length} homebrew
          </Badge>
        )}
      </div>

      {!hasCustomizations ? (
        <div className="p-6 rounded-lg border border-dashed border-muted/50 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No customizations yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Edit abilities in the skill trees or create homebrew abilities
          </p>
        </div>
      ) : (
        <>
          {/* Modified Abilities Section */}
          {overridesList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Modified Abilities ({overridesList.length})
                </span>
              </div>
              
              <div className="space-y-1.5">
                {overridesList.map(({ abilityId, baseName, customName, tree, icon }) => {
                  const Icon = getIconComponent(icon);
                  return (
                    <div
                      key={abilityId}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border',
                        'bg-muted/20 border-muted/30'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                        tree === 'hunter' && 'bg-hunter/20 text-hunter',
                        tree === 'warrior' && 'bg-warrior/20 text-warrior',
                        tree === 'assassin' && 'bg-assassin/20 text-assassin',
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {customName || baseName}
                        </p>
                        {customName && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            was: {baseName}
                          </p>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOverride(abilityId)}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Homebrew Abilities Section */}
          {homebrewList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Homebrew Abilities ({homebrewList.length})
                </span>
              </div>
              
              <div className="space-y-1.5">
                {homebrewList.map((homebrew) => {
                  const Icon = getIconComponent(homebrew.icon);
                  return (
                    <div
                      key={homebrew.id}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border',
                        'bg-primary/5 border-primary/20'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
                        homebrew.tree === 'hunter' && 'bg-hunter/20 text-hunter',
                        homebrew.tree === 'warrior' && 'bg-warrior/20 text-warrior',
                        homebrew.tree === 'assassin' && 'bg-assassin/20 text-assassin',
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{homebrew.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {homebrew.tree} • {homebrew.type}
                        </p>
                      </div>
                      
                      <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">
                        Custom
                      </Badge>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveHomebrew(homebrew.id, homebrew.name)}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <Separator className="bg-border/30" />

      {/* Export/Import Actions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Backup & Transfer
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!hasCustomizations}
            className="gap-2 h-10"
          >
            {copiedExport ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy JSON
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!hasCustomizations}
            className="gap-2 h-10"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
        </div>
        
        {/* Import Dialog */}
        <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 h-10"
            >
              <Upload className="w-4 h-4" />
              Import from JSON
            </Button>
          </AlertDialogTrigger>
          
          <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Import Customizations
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-2">
                  <p className="text-sm">
                    Paste your exported JSON data below. This will merge with your existing customizations.
                  </p>
                  
                  <textarea
                    value={importText}
                    onChange={(e) => {
                      setImportText(e.target.value);
                      setImportError(null);
                    }}
                    placeholder='{"version": 1, "overrides": {}, "homebrewAbilities": []}'
                    className="w-full h-32 p-3 rounded-md border border-input bg-background text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  
                  {importError && (
                    <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{importError}</span>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={handleImport}
                disabled={!importText.trim()}
              >
                Import
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Reset All */}
      {hasCustomizations && (
        <>
          <Separator className="bg-border/30" />
          
          <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full gap-2 h-12 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Customizations
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Reset All Customizations?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 pt-2">
                    <p className="text-sm">
                      This will permanently delete:
                    </p>
                    
                    <div className="bg-destructive/10 rounded-md p-3 space-y-2">
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Pencil className="w-4 h-4 text-amber-400" />
                        {overridesList.length} modified abilit{overridesList.length !== 1 ? 'ies' : 'y'}
                      </p>
                      <p className="text-sm text-foreground flex items-center gap-2">
                        <Plus className="w-4 h-4 text-primary" />
                        {homebrewList.length} homebrew abilit{homebrewList.length !== 1 ? 'ies' : 'y'}
                      </p>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      Consider exporting your customizations first as a backup.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
