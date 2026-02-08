import { useState, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  Save, 
  FolderOpen,
  Replace,
  Palette,
  User,
  Pencil,
  X,
  FileText,
  HelpCircle,
  FlaskConical,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useEditingRules } from '@/hooks/use-editing-rules';
import { supabase } from '@/integrations/supabase/client';
import { 
  EditingRule, 
  RuleType, 
  RuleScope,
  RULE_TEMPLATES,
  MAX_RULES,
  getRuleTypeLabel,
  detectRuleType,
} from '@/lib/scribe/editingRules';

// Icon component that maps rule types to icons
function RuleTypeIcon({ type, className = 'w-4 h-4' }: { type: RuleType; className?: string }) {
  switch (type) {
    case 'replace': return <Replace className={className} />;
    case 'remove': return <Trash2 className={className} />;
    case 'style': return <Palette className={className} />;
    case 'character': return <User className={className} />;
    case 'custom': return <Pencil className={className} />;
    default: return <Pencil className={className} />;
  }
}

interface EditingRulesEditorProps {
  onRulesChange?: (rules: EditingRule[]) => void;
  sampleText?: string;
  characterName?: string;
  narrativeStyle?: string;
}

export function EditingRulesEditor({ 
  onRulesChange, 
  sampleText = '',
  characterName = '',
  narrativeStyle = 'fantasy',
}: EditingRulesEditorProps) {
  const { toast } = useToast();
  const {
    rules,
    addRule,
    updateRule,
    removeRule,
    reorderRules,
    clearAllRules,
    canAddRule,
    validRuleCount,
    savedRuleSets,
    saveAsRuleSet,
    loadRuleSet,
    deleteRuleSet,
  } = useEditingRules();

  const [isOpen, setIsOpen] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [ruleSetName, setRuleSetName] = useState('');
  
  // Test preview state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testSampleInput, setTestSampleInput] = useState('');

  // Notify parent when rules change
  const handleRulesChange = useCallback(() => {
    onRulesChange?.(rules);
  }, [rules, onRulesChange]);

  // Add a new rule
  const handleAddRule = useCallback(() => {
    if (!newRuleText.trim()) {
      toast({
        title: 'Empty rule',
        description: 'Please enter a rule instruction.',
        variant: 'destructive',
      });
      return;
    }

    if (!canAddRule) {
      toast({
        title: 'Rule limit reached',
        description: `Maximum of ${MAX_RULES} rules allowed.`,
        variant: 'destructive',
      });
      return;
    }

    const success = addRule(newRuleText.trim());
    if (success) {
      setNewRuleText('');
      handleRulesChange();
      toast({
        title: 'Rule added',
        description: 'Your editing rule has been added.',
      });
    }
  }, [newRuleText, canAddRule, addRule, handleRulesChange, toast]);

  // Add from template
  const handleAddFromTemplate = useCallback((template: typeof RULE_TEMPLATES[0]) => {
    if (!canAddRule) {
      toast({
        title: 'Rule limit reached',
        description: `Maximum of ${MAX_RULES} rules allowed.`,
        variant: 'destructive',
      });
      return;
    }

    addRule(template.template, template.type);
    handleRulesChange();
    toast({
      title: 'Template added',
      description: 'Edit the placeholders in brackets to customize.',
    });
  }, [canAddRule, addRule, handleRulesChange, toast]);

  // Move rule up/down
  const handleMoveRule = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rules.length) return;
    reorderRules(index, newIndex);
    handleRulesChange();
  }, [rules.length, reorderRules, handleRulesChange]);

  // Save current rules as a set
  const handleSaveRuleSet = useCallback(() => {
    if (rules.length === 0) {
      toast({
        title: 'No rules to save',
        description: 'Add some rules before saving.',
        variant: 'destructive',
      });
      return;
    }

    const name = ruleSetName.trim() || `Rule Set ${savedRuleSets.length + 1}`;
    saveAsRuleSet(name);
    setRuleSetName('');
    setSaveDialogOpen(false);
    toast({
      title: 'Rule set saved',
      description: `"${name}" has been saved.`,
    });
  }, [rules.length, ruleSetName, savedRuleSets.length, saveAsRuleSet, toast]);

  // Load a saved rule set
  const handleLoadRuleSet = useCallback((id: string) => {
    loadRuleSet(id);
    handleRulesChange();
    toast({
      title: 'Rule set loaded',
      description: 'Your saved rules have been loaded.',
    });
  }, [loadRuleSet, handleRulesChange, toast]);

  // Test rules on sample text
  const handleTestRules = useCallback(async () => {
    const textToTest = testSampleInput.trim() || sampleText.slice(0, 500);
    
    if (!textToTest) {
      toast({
        title: 'No sample text',
        description: 'Paste some text to test, or enter text in the main input first.',
        variant: 'destructive',
      });
      return;
    }

    if (rules.filter(r => r.isValid).length === 0) {
      toast({
        title: 'No valid rules',
        description: 'Add at least one valid rule to test.',
        variant: 'destructive',
      });
      return;
    }

    setIsTesting(true);
    setTestResult('');

    try {
      const rulesForApi = rules
        .filter(r => r.isValid && r.instruction.trim())
        .map(r => ({ type: r.type, instruction: r.instruction, scope: r.scope }));

      const { data, error } = await supabase.functions.invoke('narrative-forge', {
        body: {
          text: textToTest.slice(0, 500), // Limit to 500 chars for preview
          characterName,
          style: narrativeStyle,
          smartParseEnabled: false, // Don't filter for test
          customEditingRules: rulesForApi,
        },
      });

      if (error) throw error;
      
      setTestResult(data.narrative || 'No output generated.');
      toast({
        title: 'Test complete',
        description: 'Preview generated successfully.',
      });
    } catch (error) {
      console.error('Test rules error:', error);
      setTestResult(`Error: ${error instanceof Error ? error.message : 'Failed to generate preview'}`);
      toast({
        title: 'Test failed',
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(false);
    }
  }, [testSampleInput, sampleText, rules, characterName, narrativeStyle, toast]);

  // Open test dialog with pre-filled sample
  const handleOpenTestDialog = useCallback(() => {
    setTestSampleInput(sampleText.slice(0, 500));
    setTestResult('');
    setTestDialogOpen(true);
  }, [sampleText]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between p-3 h-auto hover:bg-purple-500/10 border border-purple-900/30 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium">Custom Editing Rules</span>
            {rules.length > 0 && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                {validRuleCount} active
              </span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-2">
        {/* Help tooltip */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Add rules the AI will follow when transforming your text.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs">
                Examples: "Replace 'ozone' with 'aether'", "Remove modern slang", 
                "Rename 'Bob' to 'Archmage Robert'"
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Load saved rule sets */}
        {savedRuleSets.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground shrink-0">Load saved:</Label>
            <Select onValueChange={handleLoadRuleSet}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select a rule set..." />
              </SelectTrigger>
              <SelectContent>
                {savedRuleSets.map(set => (
                  <SelectItem key={set.id} value={set.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span>{set.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({set.rules.length} rules)
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Add new rule input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type a custom editing rule..."
            value={newRuleText}
            onChange={(e) => setNewRuleText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddRule()}
            className="h-9 text-sm bg-background/50"
          />
          <Button
            size="sm"
            onClick={handleAddRule}
            disabled={!canAddRule}
            className="h-9 gap-1 bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>

          {/* Template dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <FileText className="w-4 h-4" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Quick Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {RULE_TEMPLATES.map((template, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => handleAddFromTemplate(template)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <div className="flex items-center gap-2">
                    <RuleTypeIcon type={template.type} className="w-3.5 h-3.5" />
                    <span className="font-medium">{template.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-5">
                    {template.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Rules list */}
        {rules.length > 0 ? (
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={index}
                isFirst={index === 0}
                isLast={index === rules.length - 1}
                onUpdate={(updates) => {
                  updateRule(rule.id, updates);
                  handleRulesChange();
                }}
                onRemove={() => {
                  removeRule(rule.id);
                  handleRulesChange();
                }}
                onMoveUp={() => handleMoveRule(index, 'up')}
                onMoveDown={() => handleMoveRule(index, 'down')}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3 bg-muted/20 rounded-lg">
            No custom rules added. Rules are optional.
          </p>
        )}

        {/* Action buttons */}
        {rules.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {/* Test rules on sample */}
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-1 text-xs border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                  onClick={handleOpenTestDialog}
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  Test Rules
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-purple-400" />
                    Test Rules on Sample
                  </DialogTitle>
                  <DialogDescription>
                    See how your {validRuleCount} rule{validRuleCount !== 1 ? 's' : ''} will transform the first 500 characters.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-hidden space-y-4 py-2">
                  {/* Sample input */}
                  <div className="space-y-2">
                    <Label htmlFor="testSampleInput" className="text-sm">Sample Text (max 500 chars)</Label>
                    <Textarea
                      id="testSampleInput"
                      value={testSampleInput}
                      onChange={(e) => setTestSampleInput(e.target.value.slice(0, 500))}
                      placeholder="Paste sample text to test your rules..."
                      className="h-32 font-mono text-xs resize-none"
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {testSampleInput.length}/500 characters
                    </p>
                  </div>
                  
                  {/* Result */}
                  {(testResult || isTesting) && (
                    <div className="space-y-2">
                      <Label className="text-sm">Preview Result</Label>
                      <ScrollArea className="h-48 rounded-lg border border-border/50 bg-muted/20 p-3">
                        {isTesting ? (
                          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Generating preview...</span>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap font-serif leading-relaxed">
                            {testResult}
                          </p>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    onClick={handleTestRules}
                    disabled={isTesting || !testSampleInput.trim()}
                    className="gap-1 bg-purple-600 hover:bg-purple-700"
                  >
                    {isTesting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <FlaskConical className="w-4 h-4" />
                        Run Test
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Save as rule set */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1 text-xs">
                  <Save className="w-3.5 h-3.5" />
                  Save Set
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Save Rule Set</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="ruleSetName">Rule Set Name</Label>
                    <Input
                      id="ruleSetName"
                      value={ruleSetName}
                      onChange={(e) => setRuleSetName(e.target.value)}
                      placeholder="My Fantasy Cleanup Rules"
                      className="w-full"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saving {rules.length} rule{rules.length !== 1 ? 's' : ''} to this set.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveRuleSet} className="bg-purple-600 hover:bg-purple-700">
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Clear all */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearAllRules();
                handleRulesChange();
              }}
              className="gap-1 text-xs text-destructive hover:text-destructive"
            >
              <X className="w-3.5 h-3.5" />
              Clear All
            </Button>

            {/* Rule count */}
            <span className="text-xs text-muted-foreground ml-auto self-center">
              {rules.length}/{MAX_RULES} rules
            </span>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Individual rule card component
interface RuleCardProps {
  rule: EditingRule;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: Partial<Pick<EditingRule, 'instruction' | 'scope' | 'type'>>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function RuleCard({
  rule,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: RuleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(rule.instruction);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onUpdate({ instruction: editText.trim(), type: detectRuleType(editText.trim()) });
    }
    setIsEditing(false);
  };

  return (
    <div 
      className={`
        relative p-3 rounded-lg border bg-background/30
        ${rule.isValid ? 'border-border/50' : 'border-destructive/50'}
        ${rule.validationWarning && rule.isValid ? 'border-yellow-500/30' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-muted-foreground w-5">
          {index + 1}.
        </span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-muted/50">
          <RuleTypeIcon type={rule.type} className="w-3 h-3 text-purple-400" />
          <span className="text-xs text-muted-foreground">
            {getRuleTypeLabel(rule.type)}
          </span>
        </div>
        
        {/* Scope selector */}
        <Select 
          value={rule.scope} 
          onValueChange={(value: RuleScope) => onUpdate({ scope: value })}
        >
          <SelectTrigger className="h-6 w-auto text-xs px-2 bg-transparent border-0 hover:bg-muted/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Text</SelectItem>
            <SelectItem value="dialogue">Dialogue Only</SelectItem>
            <SelectItem value="narration">Narration Only</SelectItem>
            <SelectItem value="combat">Combat Only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {/* Reorder buttons */}
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Rule instruction */}
      {isEditing ? (
        <div className="flex gap-2">
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleSaveEdit}>
            Save
          </Button>
        </div>
      ) : (
        <button
          onClick={() => {
            setEditText(rule.instruction);
            setIsEditing(true);
          }}
          className="text-sm text-left w-full hover:bg-muted/30 rounded px-1 py-0.5 -mx-1"
        >
          {rule.instruction || <span className="text-muted-foreground italic">Click to edit...</span>}
        </button>
      )}

      {/* Validation warning */}
      {rule.validationWarning && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-500">
          <AlertTriangle className="w-3 h-3" />
          {rule.validationWarning}
        </div>
      )}
    </div>
  );
}
