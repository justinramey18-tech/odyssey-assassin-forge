import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { QUESTIONS, SECTION_HEADERS, TOTAL_QUESTIONS } from '@/lib/personality-test/questions';
import { saveTestProgress } from '@/lib/personality-test/api';
import type { Answer, TestProgress } from '@/lib/personality-test/types';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PersonalityTestWizardProps {
  userId: string;
  initialProgress: TestProgress | null;
  onComplete: (answers: Answer[]) => Promise<void>;
  onClose: () => void;
}

export function PersonalityTestWizard({
  userId,
  initialProgress,
  onComplete,
  onClose,
}: PersonalityTestWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (initialProgress && initialProgress.answers.length > 0) {
      return Math.min(initialProgress.answers.length, TOTAL_QUESTIONS - 1);
    }
    return 0;
  });
  const [answers, setAnswers] = useState<Answer[]>(() =>
    initialProgress?.answers ?? []
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isCompleting, setIsCompleting] = useState(false);
  const savingRef = useRef(false);

  const question = QUESTIONS[currentIndex];
  const section = SECTION_HEADERS[question.section];
  const progressPct = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;

  // Existing answer for this question (for going back)
  const existingAnswer = answers.find(a => a.questionId === question.id);

  const handleAnswer = useCallback(async (value: string) => {
    if (isCompleting || savingRef.current) return;

    const newAnswers = [
      ...answers.filter(a => a.questionId !== question.id),
      { questionId: question.id, value },
    ];
    setAnswers(newAnswers);

    // Save progress (fire & forget, don't block)
    savingRef.current = true;
    saveTestProgress(userId, newAnswers, currentIndex + 1).finally(() => {
      savingRef.current = false;
    });

    if (currentIndex < TOTAL_QUESTIONS - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    } else {
      // Last question → complete
      setIsCompleting(true);
      await onComplete(newAnswers);
    }
  }, [answers, currentIndex, question.id, userId, onComplete, isCompleting]);

  const handleBack = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Determine section transition
  const prevQuestion = currentIndex > 0 ? QUESTIONS[currentIndex - 1] : null;
  const isNewSection = !prevQuestion || prevQuestion.section !== question.section;
  const sectionNumber = question.section === 'explore' ? 1 : question.section === 'connect' ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-xl overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={currentIndex > 0 ? handleBack : onClose}
            className="flex items-center gap-1 text-sm text-amber-400/70 hover:text-amber-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {currentIndex > 0 ? 'Back' : 'Cancel'}
          </button>
          <span className="text-xs text-white/40 font-cinzel">
            {currentIndex + 1} / {TOTAL_QUESTIONS}
          </span>
        </div>

        <Progress
          value={progressPct}
          className="h-1.5 bg-white/10"
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={question.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full max-w-md flex flex-col items-center"
          >
            {/* Section header */}
            <div className="text-center mb-6">
              <span className="text-xs text-amber-500/60 uppercase tracking-widest font-cinzel">
                Part {sectionNumber}
              </span>
              <h2 className="text-lg font-cinzel text-amber-300 mt-1">
                {section.title}
              </h2>
              <p className="text-xs text-white/40 mt-0.5">{section.subtitle}</p>
            </div>

            {/* Question */}
            <p className="text-base text-white/90 text-center leading-relaxed mb-8 font-medium">
              {question.text}
            </p>

            {/* Options */}
            <div className="w-full space-y-3">
              <OptionButton
                text={question.optionA.text}
                selected={existingAnswer?.value === question.optionA.value}
                onClick={() => handleAnswer(question.optionA.value)}
                disabled={isCompleting}
              />
              <OptionButton
                text={question.optionB.text}
                selected={existingAnswer?.value === question.optionB.value}
                onClick={() => handleAnswer(question.optionB.value)}
                disabled={isCompleting}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex-none px-6 pb-6 pt-2 text-center">
        {isCompleting ? (
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-cinzel">Summoning your DM…</span>
          </div>
        ) : (
          <p className="text-xs text-white/25">
            Your answers shape your DM's personality
          </p>
        )}
      </div>
    </div>
  );
}

function OptionButton({
  text,
  selected,
  onClick,
  disabled,
}: {
  text: string;
  selected: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-5 py-4 rounded-xl border transition-all duration-200',
        'bg-white/[0.03] hover:bg-white/[0.07] active:scale-[0.98]',
        selected
          ? 'border-amber-500/60 bg-amber-900/20 text-amber-200'
          : 'border-white/10 text-white/80 hover:border-amber-500/30',
        disabled && 'opacity-50 pointer-events-none',
      )}
      style={{ touchAction: 'manipulation' }}
    >
      <span className="text-sm leading-relaxed">{text}</span>
    </button>
  );
}
