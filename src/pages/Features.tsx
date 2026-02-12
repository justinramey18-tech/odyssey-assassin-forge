import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowLeft, Rocket, ChevronDown } from 'lucide-react';
import { getIconByName } from '@/lib/iconUtils';
import { FEATURE_CATEGORIES } from '@/lib/features-showcase-data';
import { Glass } from '@/components/ui/glass';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const featureVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export default function Features() {
  const navigate = useNavigate();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    // Start with the first category expanded
    return new Set([FEATURE_CATEGORIES[0]?.id ?? '']);
  });

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(FEATURE_CATEGORIES.map((c) => c.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  const allExpanded = expandedCategories.size === FEATURE_CATEGORIES.length;

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGoToFeature = useCallback(
    (tab?: string) => {
      if (tab) {
        navigate(`/?tab=${tab}`);
      } else {
        navigate('/');
      }
    },
    [navigate],
  );

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-cinzel hidden sm:inline">Back</span>
          </button>

          <h1 className="font-cinzel text-lg sm:text-xl tracking-wider text-foreground">
            Feature Showcase
          </h1>

          <Button
            size="sm"
            onClick={() => navigate('/')}
            className="gap-1.5 font-cinzel text-xs"
          >
            <Rocket className="w-3.5 h-3.5" />
            Launch App
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto text-center"
        >
          Everything you need to run your D&D character — from creation to campaign's end.
        </motion.p>

        {/* Expand / Collapse All toggle */}
        <div className="flex justify-end mt-3">
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className="text-[11px] font-cinzel uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-white/10 hover:border-white/20"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>
      </section>

      {/* Category Sections */}
      <motion.main
        className="mx-auto max-w-4xl px-4 pb-24 space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {FEATURE_CATEGORIES.map((category) => {
          const CategoryIcon = getIconByName(category.iconName);
          const isExpanded = expandedCategories.has(category.id);

          return (
            <motion.div key={category.id} variants={cardVariants}>
              <Glass
                variant="default"
                rounded="xl"
                className={cn('overflow-hidden', category.borderColor)}
              >
                {/* Category Header — clickable toggle */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center gap-3 p-4 sm:p-6 text-left hover:bg-white/[0.03] transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      category.bgAccent,
                    )}
                  >
                    <CategoryIcon className={cn('w-5 h-5', category.textColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className={cn('font-cinzel text-base sm:text-lg tracking-wide', category.textColor)}>
                      {category.label}
                    </h2>
                    <p className="text-muted-foreground text-xs sm:text-sm truncate">
                      {category.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {category.features.length}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </div>
                </button>

                {/* Collapsible Features Grid */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                        <motion.div
                          className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          {category.features.map((feature) => {
                            const FeatureIcon = getIconByName(feature.iconName);

                            return (
                              <motion.div
                                key={feature.id}
                                variants={featureVariants}
                                className={cn(
                                  'group flex items-start gap-3 p-3 rounded-lg',
                                  'bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/10',
                                  'transition-all duration-200',
                                )}
                              >
                                <div className={cn('mt-0.5 shrink-0', category.textColor)}>
                                  <FeatureIcon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-medium text-foreground truncate">
                                      {feature.name}
                                    </h3>
                                    {feature.navigateTo && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGoToFeature(feature.navigateTo);
                                        }}
                                        className={cn(
                                          'shrink-0 text-[10px] font-cinzel uppercase tracking-wider px-2 py-0.5 rounded',
                                          'border border-white/20 hover:border-white/40',
                                          'text-muted-foreground hover:text-foreground',
                                          'opacity-0 group-hover:opacity-100 transition-opacity',
                                          'sm:opacity-0 sm:group-hover:opacity-100',
                                          'max-sm:opacity-70',
                                        )}
                                      >
                                        Go →
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                                    {feature.description}
                                  </p>
                                </div>
                              </motion.div>
                            );
                          })}
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Glass>
            </motion.div>
          );
        })}
      </motion.main>

      {/* Back to Top FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: showBackToTop ? 1 : 0,
          scale: showBackToTop ? 1 : 0.8,
          pointerEvents: showBackToTop ? 'auto' as const : 'none' as const,
        }}
        transition={{ duration: 0.2 }}
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
    </div>
  );
}