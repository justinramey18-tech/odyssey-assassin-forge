// Create/Edit Campaign Sheet
// Bottom sheet for creating or editing campaigns

import { useState, useEffect } from 'react';
import { Folder, User, MapPin, X, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Campaign } from '@/lib/chronicleSync/multiSession/types';

interface CreateCampaignSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCampaign?: Campaign | null;
  onSave: (data: {
    name: string;
    description?: string;
    dmName?: string;
    setting?: string;
    tags: string[];
  }) => void;
}

export function CreateCampaignSheet({ 
  open, 
  onOpenChange, 
  editingCampaign,
  onSave 
}: CreateCampaignSheetProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dmName, setDmName] = useState('');
  const [setting, setSetting] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Reset form when sheet opens/closes or editing changes
  useEffect(() => {
    if (open) {
      if (editingCampaign) {
        setName(editingCampaign.name);
        setDescription(editingCampaign.description || '');
        setDmName(editingCampaign.dmName || '');
        setSetting(editingCampaign.setting || '');
        setTags(editingCampaign.tags);
      } else {
        setName('');
        setDescription('');
        setDmName('');
        setSetting('');
        setTags([]);
      }
      setTagInput('');
    }
  }, [open, editingCampaign]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      dmName: dmName.trim() || undefined,
      setting: setting.trim() || undefined,
      tags,
    });
    
    onOpenChange(false);
  };

  const isEditing = !!editingCampaign;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-primary" />
            {isEditing ? 'Edit Campaign' : 'New Campaign'}
          </SheetTitle>
          <SheetDescription>
            {isEditing 
              ? 'Update your campaign details below.'
              : 'Create a folder to organize your session logs.'}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-6 overflow-y-auto max-h-[calc(85vh-200px)]">
          {/* Campaign Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Curse of Strahd"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A brief summary of your campaign..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* DM Name */}
          <div className="space-y-2">
            <Label htmlFor="dmName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Dungeon Master
            </Label>
            <Input
              id="dmName"
              placeholder="Who's running this campaign?"
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Setting */}
          <div className="space-y-2">
            <Label htmlFor="setting" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Setting
            </Label>
            <Input
              id="setting"
              placeholder="e.g., Forgotten Realms, Eberron"
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-10"
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10}
                className="h-10 w-10 shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 p-0.5 rounded-full hover:bg-foreground/10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {tags.length}/10 tags
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border/50">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {isEditing ? 'Save Changes' : 'Create Campaign'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
