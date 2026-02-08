import { useState } from 'react';
import { Save, FolderOpen, Trash2, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProcessingTemplate, getTemplateSummary } from '@/lib/scribe/processingTemplates';

interface TemplateControlsProps {
  templates: ProcessingTemplate[];
  canAddTemplate: boolean;
  onSaveTemplate: (name: string) => void;
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export function TemplateControls({
  templates,
  canAddTemplate,
  onSaveTemplate,
  onLoadTemplate,
  onDeleteTemplate,
}: TemplateControlsProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const handleSave = () => {
    if (!templateName.trim()) return;
    onSaveTemplate(templateName.trim());
    setTemplateName('');
    setSaveDialogOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Load Template Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={templates.length === 0}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Load
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
          {templates.length === 0 ? (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No saved templates
            </div>
          ) : (
            templates.map((template, index) => (
              <div key={template.id}>
                {index > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  className="flex-col items-start gap-0.5 cursor-pointer"
                  onClick={() => onLoadTemplate(template.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium text-sm">{template.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTemplate(template.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {getTemplateSummary(template)}
                  </span>
                </DropdownMenuItem>
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Template Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            disabled={!canAddTemplate}
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Processing Template</DialogTitle>
            <DialogDescription>
              Save your current settings (style, options, and editing rules) as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Template name (e.g., 'Dark Fantasy Campaign')"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!templateName.trim()}>
              <Check className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
