import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import {
  Wand2,
  Clipboard,
  Trash2,
  Plus,
  Check,
  Copy,
  AlertCircle,
  RotateCcw,
  FileText,
  CheckSquare,
  Square,
  Edit3,
  X,
  ChevronDown,
  Download,
  Sparkles,
  Loader2,
} from 'lucide-react';

const SAMPLE_QUESTIONS = `1. What is the first pillar of Islam?
A) Shahada (correct)
B) Salah
C) Zakat
D) Sawm

2. መሬት በፀሐይ ዙሪያ ትዞራለች።
A) እውነት *
B) ሐሰት

3. Write a short explanation about the Importance of Tawheed.`;

export default function AiFormatTab({ onInsertCsv }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resultQuestions, setResultQuestions] = useState(null);

  // Exam Selection Modal / Dropdown state
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [addingToExam, setAddingToExam] = useState(false);
  const [showExamDropdown, setShowExamDropdown] = useState(false);
  const [addSuccessToast, setAddSuccessToast] = useState(null);

  const abortControllerRef = useRef(null);

  // Fetch available editable exams for "Add to exam..." action
  useEffect(() => {
    async function fetchExams() {
      try {
        const res = await api.get('/api/exams');
        const list = (res.data?.exams || []).filter((e) => e.status !== 'closed');
        setExams(list);
        if (list.length > 0) {
          setSelectedExamId(list[0]._id);
        }
      } catch (err) {
        // ignore
      }
    }
    fetchExams();
  }, []);

  const handleFormat = async () => {
    if (!rawText.trim() || loading) return;

    setLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      const { data } = await api.post(
        '/api/ai/format-questions',
        { rawText: rawText.trim() },
        { signal: abortControllerRef.current.signal }
      );

      if (Array.isArray(data.questions)) {
        setResultQuestions(data.questions);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        return;
      }
      const msg = err.response?.data?.error || err.message || t('errors.GENERIC');
      setError(msg);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setRawText((prev) => (prev ? `${prev}\n\n${text}` : text));
        }
      }
    } catch (err) {
      // Fallback
    }
  };

  const handleClear = () => {
    setRawText('');
    setResultQuestions(null);
    setError(null);
  };

  const handleLoadExample = () => {
    setRawText(SAMPLE_QUESTIONS);
    setResultQuestions(null);
  };

  // Card Modifications
  const toggleSelectCard = (id) => {
    setResultQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, selected: !q.selected } : q))
    );
  };

  const handleSelectAllValid = () => {
    setResultQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        selected: q.warnings.length === 0,
      }))
    );
  };

  const handleDeleteCard = (id) => {
    setResultQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleUpdateCardText = (id, newText) => {
    setResultQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const warnings = [...q.warnings];
        if (newText.length > 500 && !warnings.includes('textTooLong')) {
          warnings.push('textTooLong');
        } else if (newText.length <= 500) {
          const filtered = warnings.filter((w) => w !== 'textTooLong');
          return { ...q, text: newText, warnings: filtered };
        }
        return { ...q, text: newText, warnings };
      })
    );
  };

  const handleUpdateCardType = (id, newType) => {
    setResultQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, type: newType } : q))
    );
  };

  const handleToggleOptionCorrect = (qId, optionId) => {
    setResultQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const isMulti = q.type === 'mcq_multi';
        const updatedOptions = q.options.map((o) => {
          if (o.id === optionId) {
            return { ...o, isCorrect: isMulti ? !o.isCorrect : true };
          }
          return isMulti ? o : { ...o, isCorrect: false };
        });

        const correctOpt = updatedOptions.find((o) => o.isCorrect);
        const warnings = q.warnings.filter((w) => w !== 'noCorrectAnswer');
        if (!correctOpt && q.type !== 'short_answer') {
          warnings.push('noCorrectAnswer');
        }

        return {
          ...q,
          options: updatedOptions,
          correctAnswer: correctOpt ? correctOpt.id : '',
          warnings,
        };
      })
    );
  };

  const handleUpdateOptionText = (qId, optionId, newText) => {
    setResultQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const updatedOptions = q.options.map((o) =>
          o.id === optionId ? { ...o, text: newText } : o
        );
        return { ...q, options: updatedOptions };
      })
    );
  };

  const handleAddOption = (qId) => {
    setResultQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const count = q.options.length;
        const newOpt = {
          id: `opt_${qId}_${count}_${Math.random().toString(36).substr(2, 4)}`,
          text: `Option ${String.fromCharCode(65 + count)}`,
          label: String.fromCharCode(65 + count),
          isCorrect: false,
        };
        const updatedOptions = [...q.options, newOpt];
        const warnings = q.warnings.filter((w) => w !== 'fewOptions');
        return { ...q, options: updatedOptions, warnings };
      })
    );
  };

  const handleRemoveOption = (qId, optionId) => {
    setResultQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const updatedOptions = q.options.filter((o) => o.id !== optionId);
        const warnings = [...q.warnings];
        if (updatedOptions.length < 2 && !warnings.includes('fewOptions')) {
          warnings.push('fewOptions');
        }
        return { ...q, options: updatedOptions, warnings };
      })
    );
  };

  // Export / Add Actions
  const handleAddToExam = async () => {
    if (!selectedExamId || !resultQuestions) return;
    const selected = resultQuestions.filter((q) => q.selected);
    if (selected.length === 0) return;

    setAddingToExam(true);
    try {
      const payload = selected.map((q) => ({
        text: q.text,
        type: q.type,
        marks: q.marks || 1,
        options: q.options.map((o) => ({ id: o.id, text: o.text })),
        correctAnswer: q.correctAnswer || (q.options.find((o) => o.isCorrect)?.id || q.options[0]?.id || ''),
        explanation: q.explanation || '',
      }));

      await api.post(`/api/exams/${selectedExamId}/questions/import`, {
        questions: payload,
      });

      setAddSuccessToast({
        count: selected.length,
        examId: selectedExamId,
      });
      setShowExamDropdown(false);
    } catch (err) {
      setError(err.response?.data?.error || t('errors.GENERIC'));
    } finally {
      setAddingToExam(false);
    }
  };

  const handleCopyAsText = () => {
    if (!resultQuestions) return;
    const text = resultQuestions
      .map((q, idx) => {
        let block = `${idx + 1}. ${q.text}`;
        if (q.type !== 'short_answer' && q.options.length > 0) {
          const opts = q.options
            .map((o) => `   ${o.label}) ${o.text}${o.isCorrect ? ' *' : ''}`)
            .join('\n');
          block += `\n${opts}`;
        }
        return block;
      })
      .join('\n\n');

    navigator.clipboard.writeText(text);
  };

  const selectedCount = resultQuestions ? resultQuestions.filter((q) => q.selected).length : 0;
  const attentionCount = resultQuestions
    ? resultQuestions.filter((q) => q.warnings.length > 0).length
    : 0;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Input Phase */}
      {!resultQuestions ? (
        <div className="flex flex-col h-full space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs text-surface-400 dark:text-surface-400 leading-relaxed">
              {t('ai.pasteHelper')}
            </p>
          </div>

          <div className="relative flex-1 min-h-[220px] flex flex-col">
            <textarea
              rows={8}
              dir="auto"
              value={rawText}
              onChange={(e) => {
                if (e.target.value.length <= 20000) {
                  setRawText(e.target.value);
                }
              }}
              placeholder={`1. What is the first pillar of Islam?\nA) Shahada (correct)\nB) Salah\n\n2. መሬት በፀሐይ ዙሪያ ትዞራለች።\nA) እውነት *\nB) ሐሰት`}
              className="w-full flex-1 p-3.5 text-xs font-mono rounded-2xl bg-surface-950 dark:bg-surface-950 border border-surface-700 dark:border-surface-700 text-surface-100 dark:text-surface-100 placeholder:text-surface-500/70 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 resize-none"
            />

            {/* Quick Action Toolbar over Textarea */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-surface-900/90 dark:bg-surface-900/90 backdrop-blur-md p-1 rounded-xl border border-surface-700/60 shadow-sm">
              <button
                type="button"
                onClick={handlePaste}
                className="px-2 py-1 rounded-lg hover:bg-surface-800 text-surface-300 hover:text-surface-100 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Paste from clipboard"
              >
                <Clipboard className="w-3.5 h-3.5 text-primary-400" />
                <span>{t('ai.pasteBtn')}</span>
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 rounded-lg hover:bg-rose-500/20 text-surface-400 hover:text-rose-400 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('ai.clearBtn')}</span>
                </button>
              )}
            </div>

            {/* Bottom Character Counter & Example Loader */}
            <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-surface-400">
              <button
                type="button"
                onClick={handleLoadExample}
                className="text-primary-400 hover:underline cursor-pointer font-medium"
              >
                {t('ai.loadExampleBtn')}
              </button>

              <span className={rawText.length > 16000 ? 'text-amber-400 font-bold' : ''}>
                {rawText.length} / 20,000
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={!rawText.trim() || loading}
              onClick={handleFormat}
              className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>{t('ai.formatting')}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                    className="ml-3 px-2 py-0.5 rounded bg-surface-900/60 hover:bg-rose-600 text-[10px] text-white"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>{t('ai.formatQuestionsBtn')}</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-surface-500 text-center mt-2">
              {t('ai.ctrlEnterHint')}
            </p>
          </div>
        </div>
      ) : (
        /* Result State: Reviewable Cards & Actions */
        <div className="flex flex-col h-full space-y-3 animate-fade-in">
          {/* Header Summary & Selection Toolbar */}
          <div className="p-3 rounded-2xl bg-surface-950 dark:bg-surface-950 border border-surface-800 flex items-center justify-between gap-2 shrink-0">
            <div>
              <div className="text-xs font-bold text-surface-100 flex items-center gap-2">
                <span>
                  {t('ai.summaryCount', { count: resultQuestions.length })}
                </span>
                {attentionCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold border border-amber-500/30">
                    {t('ai.summaryAttention', { count: attentionCount })}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-surface-400 mt-0.5">
                {selectedCount} of {resultQuestions.length} selected for import
              </p>
            </div>

            <button
              type="button"
              onClick={handleSelectAllValid}
              className="px-2.5 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5 text-primary-400" />
              <span>{t('ai.selectAllValid')}</span>
            </button>
          </div>

          {addSuccessToast && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
              <span>{t('ai.addedQuestionsSuccess', { count: addSuccessToast.count })}</span>
              <button
                type="button"
                onClick={() => navigate(`/admin/exams/${addSuccessToast.examId}`)}
                className="font-bold underline text-xs hover:text-white"
              >
                {t('ai.goToExam')} &rarr;
              </button>
            </div>
          )}

          {/* Cards Scrollable Container */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {resultQuestions.map((q, qIdx) => (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  q.selected
                    ? 'bg-surface-900/90 border-primary-500/50 shadow-md'
                    : 'bg-surface-950/60 border-surface-800 opacity-75'
                }`}
              >
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSelectCard(q.id)}
                      className="cursor-pointer text-primary-400 mt-0.5"
                    >
                      {q.selected ? (
                        <CheckSquare className="w-4 h-4 text-primary-500" />
                      ) : (
                        <Square className="w-4 h-4 text-surface-500" />
                      )}
                    </button>
                    <span className="text-xs font-bold text-surface-400">
                      #{qIdx + 1}
                    </span>
                    <select
                      value={q.type}
                      onChange={(e) => handleUpdateCardType(q.id, e.target.value)}
                      className="px-2 py-0.5 rounded-lg bg-surface-950 border border-surface-700 text-[11px] text-surface-300 focus:outline-none"
                    >
                      <option value="mcq_single">{t('ai.mcqSingle')}</option>
                      <option value="mcq_multi">{t('ai.mcqMulti')}</option>
                      <option value="true_false">{t('ai.trueFalse')}</option>
                      <option value="short_answer">{t('ai.shortAnswer')}</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCard(q.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-surface-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title={t('ai.deleteQuestion')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Question Text Field */}
                <div>
                  <textarea
                    rows={2}
                    dir="auto"
                    value={q.text}
                    onChange={(e) => handleUpdateCardText(q.id, e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-surface-950 border border-surface-700 text-surface-100 focus:outline-none focus:border-primary-500 resize-none font-medium"
                  />
                </div>

                {/* Warnings List */}
                {q.warnings.length > 0 && (
                  <div className="space-y-1">
                    {q.warnings.map((warn, wIdx) => (
                      <div
                        key={wIdx}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] flex items-center gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{t(`ai.${warn}`)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* MCQ / True-False Options */}
                {q.type !== 'short_answer' && (
                  <div className="space-y-2 pt-1 border-t border-surface-800/60">
                    <div className="text-[11px] font-semibold text-surface-400 flex items-center justify-between">
                      <span>Options (mark correct answer)</span>
                      <button
                        type="button"
                        onClick={() => handleAddOption(q.id)}
                        className="text-primary-400 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{t('ai.addOption')}</span>
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleOptionCorrect(q.id, opt.id)}
                            className={`p-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              opt.isCorrect
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                                : 'bg-surface-950 border-surface-700 text-surface-400 hover:border-surface-500'
                            }`}
                            title="Toggle as correct answer"
                          >
                            <Check className={`w-3.5 h-3.5 ${opt.isCorrect ? 'text-emerald-400' : 'opacity-0'}`} />
                            <span>{opt.label}</span>
                          </button>

                          <input
                            type="text"
                            dir="auto"
                            value={opt.text}
                            onChange={(e) => handleUpdateOptionText(q.id, opt.id, e.target.value)}
                            className={`flex-1 px-2.5 py-1 text-xs rounded-lg bg-surface-950 border text-surface-100 focus:outline-none ${
                              opt.isCorrect ? 'border-emerald-500/40 text-emerald-200' : 'border-surface-700'
                            }`}
                          />

                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(q.id, opt.id)}
                              className="p-1 text-surface-500 hover:text-rose-400 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Toolbar Actions */}
          <div className="pt-2 border-t border-surface-800 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setShowExamDropdown(!showExamDropdown)}
                  className="w-full py-2.5 px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs flex items-center justify-between transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  disabled={selectedCount === 0 || addingToExam}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>{t('ai.addToExam')}</span>
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>

                {showExamDropdown && (
                  <div className="absolute bottom-full mb-2 left-0 right-0 bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl p-2 space-y-2 z-50 animate-scale-in">
                    <div className="text-[11px] font-semibold text-surface-400 px-2 pt-1">
                      {t('ai.selectExam')}
                    </div>
                    {exams.length === 0 ? (
                      <div className="p-3 text-xs text-surface-500 text-center">
                        No editable exams found. Create an exam first.
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {exams.map((ex) => (
                          <button
                            key={ex._id}
                            type="button"
                            onClick={() => {
                              setSelectedExamId(ex._id);
                            }}
                            className={`w-full p-2 rounded-xl text-xs text-left truncate transition-colors cursor-pointer flex items-center justify-between ${
                              selectedExamId === ex._id
                                ? 'bg-primary-600/30 text-primary-300 font-bold border border-primary-500/40'
                                : 'hover:bg-surface-800 text-surface-300'
                            }`}
                          >
                            <span className="truncate">{ex.title}</span>
                            {selectedExamId === ex._id && <Check className="w-3.5 h-3.5 text-primary-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAddToExam}
                      disabled={!selectedExamId || addingToExam}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {addingToExam ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Add Selected ({selectedCount})</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCopyAsText}
                className="py-2.5 px-3 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-200 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5 text-surface-400" />
                <span className="hidden sm:inline">{t('ai.copyAsText')}</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="py-2.5 px-3 rounded-xl bg-surface-800 hover:bg-rose-500/20 text-surface-400 hover:text-rose-400 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('ai.startOver')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
